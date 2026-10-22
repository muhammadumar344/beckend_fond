const crypto = require('crypto')
const mongoose = require('mongoose')
const Class = require('../models/Class')

const TOKEN_TTL_MS = 15 * 60 * 1000

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex')

async function createGroupLink({ teacherId, classId, botUsername }) {
  if (!mongoose.Types.ObjectId.isValid(classId)) {
    const error = new Error("Sinf ID noto'g'ri")
    error.status = 400
    throw error
  }

  const cls = await Class.findOne({
    _id: classId,
    teacher: teacherId,
    archivedAt: null,
  }).select('_id name telegramGroupChatId')

  if (!cls) {
    const error = new Error("Sinf topilmadi yoki sizga tegishli emas")
    error.status = 404
    throw error
  }

  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

  cls.telegramGroupLinkTokenHash = hashToken(token)
  cls.telegramGroupLinkExpiresAt = expiresAt
  await cls.save()

  return {
    success: true,
    classId: String(cls._id),
    className: cls.name,
    linked: Boolean(cls.telegramGroupChatId),
    link: `https://t.me/${botUsername}?startgroup=grp_${token}`,
    expiresAt: expiresAt.toISOString(),
  }
}

async function bindGroupFromStart(bot, msg, token) {
  const chatType = msg?.chat?.type
  if (chatType !== 'group' && chatType !== 'supergroup') {
    await bot.sendMessage(msg.chat.id, "Sinfni ulash uchun havolani Telegram guruh ichida oching.")
    return
  }

  if (!token || !/^[a-f0-9]{48}$/i.test(token)) {
    await bot.sendMessage(msg.chat.id, "Ulanish kodi noto'g'ri yoki eskirgan. Lumo saytidan yangi havola oling.")
    return
  }

  const tokenHash = hashToken(token)
  const now = new Date()

  const cls = await Class.findOne({
    telegramGroupLinkTokenHash: tokenHash,
    telegramGroupLinkExpiresAt: { $gt: now },
    archivedAt: null,
  }).select('_id name teacher')

  if (!cls) {
    await bot.sendMessage(msg.chat.id, "Ulanish havolasi eskirgan yoki ishlatilgan. Lumo saytidan yangi havola oling.")
    return
  }

  const alreadyUsed = await Class.findOne({
    telegramGroupChatId: String(msg.chat.id),
    _id: { $ne: cls._id },
  }).select('_id')

  if (alreadyUsed) {
    await bot.sendMessage(msg.chat.id, "Bu Telegram guruhi boshqa sinfga ulangan. Avval o'sha ulanishni uzing.")
    return
  }

  try {
    const updated = await Class.findOneAndUpdate(
      {
        _id: cls._id,
        telegramGroupLinkTokenHash: tokenHash,
        telegramGroupLinkExpiresAt: { $gt: now },
      },
      {
        $set: {
          telegramGroupChatId: String(msg.chat.id),
          telegramGroupTitle: String(msg.chat.title || '').slice(0, 200),
        },
        $unset: {
          telegramGroupLinkTokenHash: 1,
          telegramGroupLinkExpiresAt: 1,
        },
      },
      { new: true },
    ).select('_id name')

    if (!updated) {
      await bot.sendMessage(msg.chat.id, "Ulanish kodi ishlatilgan yoki eskirgan. Lumo saytidan yangi havola oling.")
      return
    }

    await bot.sendMessage(
      msg.chat.id,
      `✅ Telegram guruhi Lumo tizimiga ulandi.\nSinf: ${updated.name}\nEndi guruhdagi xabarlar shu sinf bilan bog'lanadi.`,
    )
  } catch (error) {
    if (error?.code === 11000) {
      await bot.sendMessage(msg.chat.id, "Bu Telegram guruhi allaqachon boshqa sinfga ulangan.")
      return
    }
    throw error
  }
}

module.exports = { createGroupLink, bindGroupFromStart }
