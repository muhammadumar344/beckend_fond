// src/utils/messages.js
// ════════════════════════════════════════════════════════════
// Backend xabarlarining ruscha va inglizcha tarjimalari.
//
// Kalit — kodda yozilgan o'zbekcha matnning O'ZI. Shu sabab
// controller'larda hech narsa o'zgartirilmagan: `middleware/lang.js`
// javob yuborilayotganda `error`/`message` maydonini shu jadvaldan
// izlaydi va foydalanuvchi tiliga almashtiradi.
//
// Topilmasa — o'zbekcha qoladi (hech qachon bo'sh chiqmaydi).
//
// ⚠️ Kodda xabar matnini o'zgartirsangiz, shu yerdagi kalitni ham
//    yangilang. `node src/scripts/checkMessages.js` tarjimasiz
//    qolganlarini ko'rsatadi.
// ════════════════════════════════════════════════════════════

const MESSAGES = {
  // ── Umumiy / ruxsat ─────────────────────────────────────
  "Ruxsat yo'q": { ru: "Нет доступа", en: "No permission" },
  "Avtorizatsiya talab etiladi": { ru: "Требуется авторизация", en: "Authorization required" },
  "Token mavjud emas": { ru: "Токен отсутствует", en: "No token provided" },
  "Token noto'g'ri yoki muddati o'tgan": { ru: "Токен неверен или истёк", en: "Token is invalid or expired" },
  "Server xatosi": { ru: "Ошибка сервера", en: "Server error" },
  "Ichki server xatosi": { ru: "Внутренняя ошибка сервера", en: "Internal server error" },
  "Topilmadi": { ru: "Не найдено", en: "Not found" },
  "Faqat direktor uchun": { ru: "Только для директора", en: "Directors only" },
  "Faqat xodimlar uchun": { ru: "Только для сотрудников", en: "Staff only" },
  "Noma'lum foydalanuvchi roli": { ru: "Неизвестная роль пользователя", en: "Unknown user role" },
  "Xodim hisobi faol emas": { ru: "Учётная запись сотрудника неактивна", en: "Staff account is not active" },
  "Muassasa topilmadi": { ru: "Учреждение не найдено", en: "Institution not found" },
  'Ruxsat yo\'q: "viewHomework" huquqi kerak': { ru: 'Нет доступа: нужно право "viewHomework"', en: 'No permission: "viewHomework" is required' },
  'Ruxsat yo\'q: "viewLeads" huquqi kerak': { ru: 'Нет доступа: нужно право "viewLeads"', en: 'No permission: "viewLeads" is required' },

  // ── Topilmadi ───────────────────────────────────────────
  "Teacher topilmadi": { ru: "Учитель не найден", en: "Teacher not found" },
  "Xodim topilmadi": { ru: "Сотрудник не найден", en: "Staff member not found" },
  "Sinf topilmadi": { ru: "Класс не найден", en: "Class not found" },
  "Sinflar topilmadi": { ru: "Классы не найдены", en: "Classes not found" },
  "Sinf topilmadi yoki ruxsat yo'q": { ru: "Класс не найден или нет доступа", en: "Class not found or no permission" },
  "Guruh topilmadi": { ru: "Группа не найдена", en: "Group not found" },
  "Guruh topilmadi yoki ruxsat yo'q": { ru: "Группа не найдена или нет доступа", en: "Group not found or no permission" },
  "Yangi guruh topilmadi": { ru: "Новая группа не найдена", en: "New group not found" },
  "Filial topilmadi": { ru: "Филиал не найден", en: "Branch not found" },
  "O'quvchi topilmadi": { ru: "Ученик не найден", en: "Student not found" },
  "Fan topilmadi": { ru: "Предмет не найден", en: "Subject not found" },
  "Ustoz topilmadi": { ru: "Преподаватель не найден", en: "Teacher not found" },
  "Vazifa topilmadi": { ru: "Задание не найдено", en: "Assignment not found" },
  "Foydalanuvchi topilmadi": { ru: "Пользователь не найден", en: "User not found" },
  "Lid topilmadi": { ru: "Лид не найден", en: "Lead not found" },
  "So'rov topilmadi": { ru: "Заявка не найдена", en: "Request not found" },
  "Rol topilmadi": { ru: "Роль не найдена", en: "Role not found" },
  "Yangi rol topilmadi": { ru: "Новая роль не найдена", en: "New role not found" },
  "Maosh yozuvi topilmadi": { ru: "Запись о зарплате не найдена", en: "Salary record not found" },
  "Jadval topilmadi": { ru: "Расписание не найдено", en: "Schedule not found" },
  "To'lov topilmadi": { ru: "Платёж не найден", en: "Payment not found" },
  "SMS xizmati sozlanmagan": {
    ru: "SMS-сервис не настроен",
    en: "SMS service is not configured",
  },
  "Baho topilmadi": { ru: "Оценка не найдена", en: "Grade not found" },
  "Aktiv freeze topilmadi": { ru: "Активная заморозка не найдена", en: "No active freeze found" },
  "Referral kod topilmadi": { ru: "Реферальный код не найден", en: "Referral code not found" },
  "Xarajat topilmadi yoki ruxsat yo'q": { ru: "Расход не найден или нет доступа", en: "Expense not found or no permission" },

  // ── Filial cheklovi ─────────────────────────────────────
  "Bu sinf sizning filialingizga tegishli emas": { ru: "Этот класс не относится к вашему филиалу", en: "This class does not belong to your branch" },
  "Bu guruh sizning filialingizga tegishli emas": { ru: "Эта группа не относится к вашему филиалу", en: "This group does not belong to your branch" },
  "Bu xona sizning filialingizga tegishli emas": { ru: "Этот кабинет не относится к вашему филиалу", en: "This room does not belong to your branch" },
  "Faqat o'z filialingizga xodim qo'sha olasiz": { ru: "Вы можете добавлять сотрудников только в свой филиал", en: "You can only add staff to your own branch" },
  "Filial ko'rsatilmagan": { ru: "Филиал не указан", en: "Branch not specified" },

  // ── Xonalar (kabinetlar) ────────────────────────────────
  "Xona nomi majburiy": { ru: "Название кабинета обязательно", en: "Room name is required" },
  "Bu nomli xona allaqachon mavjud": { ru: "Кабинет с таким названием уже существует", en: "A room with this name already exists" },
  "Xona topilmadi": { ru: "Кабинет не найден", en: "Room not found" },
  "Xona arxivlandi": { ru: "Кабинет архивирован", en: "Room archived" },
  "startTime va endTime majburiy": { ru: "startTime и endTime обязательны", en: "startTime and endTime are required" },
  "Qidiruv oynasi noto'g'ri: boshlanish tugashdan keyin": { ru: "Неверный интервал поиска: начало позже конца", en: "Invalid search window: the start is after the end" },

  // ── Pulni topshirish ────────────────────────────────────
  "Topshiriladigan summa noto'g'ri": { ru: "Неверная сумма для передачи", en: "Invalid amount to hand over" },
  "O'zingizga o'zingiz topshira olmaysiz": { ru: "Нельзя передать деньги самому себе", en: "You cannot hand money over to yourself" },
  "Qabul qiluvchi topilmadi": { ru: "Получатель не найден", en: "Recipient not found" },
  "Bu xodim pul qabul qila olmaydi": { ru: "Этот сотрудник не может принимать деньги", en: "This staff member cannot accept money" },
  "Topshiriq topilmadi": { ru: "Передача не найдена", en: "Handover not found" },
  "Bu topshiriq sizga emas": { ru: "Эта передача адресована не вам", en: "This handover is not addressed to you" },
  "Bu topshiriq allaqachon yakunlangan": { ru: "Эта передача уже завершена", en: "This handover is already completed" },
  "Sanalgan summa noto'g'ri": { ru: "Неверная пересчитанная сумма", en: "Invalid counted amount" },
  "Topshiriq topilmadi yoki uni bekor qilib bo'lmaydi": { ru: "Передача не найдена или её нельзя отменить", en: "Handover not found or cannot be cancelled" },
  "Rejim noto'g'ri": { ru: "Неверный режим", en: "Invalid mode" },
  "Ulanish uzildi": { ru: "Подключение разорвано", en: "Connection removed" },

  // ── Autentifikatsiya ────────────────────────────────────
  "Email yoki parol noto'g'ri": { ru: "Неверный email или пароль", en: "Wrong email or password" },
  "Email majburiy": { ru: "Email обязателен", en: "Email is required" },
  "Email va parol majburiy": { ru: "Email и пароль обязательны", en: "Email and password are required" },
  "Email va kod majburiy": { ru: "Email и код обязательны", en: "Email and code are required" },
  "Email noto'g'ri": { ru: "Неверный email", en: "Invalid email" },
  "Email noto'g'ri formatda": { ru: "Неверный формат email", en: "Invalid email format" },
  "Email @gmail.com bilan tugashi kerak": { ru: "Email должен заканчиваться на @gmail.com", en: "Email must end with @gmail.com" },
  "Bu email allaqachon band": { ru: "Этот email уже занят", en: "This email is already taken" },
  "Bu email band": { ru: "Этот email занят", en: "This email is taken" },
  "Bu email bilan xodim allaqachon mavjud": { ru: "Сотрудник с таким email уже существует", en: "A staff member with this email already exists" },
  "Bu email allaqachon ro'yxatdan o'tgan. Login qiling.": { ru: "Этот email уже зарегистрирован. Войдите в систему.", en: "This email is already registered. Please sign in." },
  "Email allaqachon tasdiqlangan": { ru: "Email уже подтверждён", en: "Email is already verified" },
  "Email hali tasdiqlanmagan": { ru: "Email ещё не подтверждён", en: "Email is not verified yet" },
  "Email tasdiqlandi": { ru: "Email подтверждён", en: "Email verified" },
  "Email muvaffaqiyatli tasdiqlandi! Endi tizimga kirishingiz mumkin.": { ru: "Email успешно подтверждён! Теперь вы можете войти.", en: "Email verified! You can sign in now." },
  "Akkaunt bloklangan": { ru: "Аккаунт заблокирован", en: "Account is blocked" },
  "Hisobingiz bloklangan. Direktor bilan bog'laning.": { ru: "Ваш аккаунт заблокирован. Свяжитесь с директором.", en: "Your account is blocked. Contact the director." },
  "Kod noto'g'ri": { ru: "Неверный код", en: "Wrong code" },
  "Kod muddati tugagan. Yangi kod so'rang.": { ru: "Срок действия кода истёк. Запросите новый код.", en: "The code has expired. Request a new one." },
  "Tasdiqlash kodi emailingizga yuborildi": { ru: "Код подтверждения отправлен на ваш email", en: "A verification code was sent to your email" },
  "Yangi kod yuborildi": { ru: "Новый код отправлен", en: "A new code was sent" },
  "Email yuborishda xatolik. Birozdan so'ng qayta urinib ko'ring.": { ru: "Ошибка при отправке email. Попробуйте позже.", en: "Failed to send the email. Please try again shortly." },
  "Agar email mavjud bo'lsa, tiklash xati yuborildi": { ru: "Если такой email существует, письмо для восстановления отправлено", en: "If that email exists, a reset link has been sent" },

  // ── Parol ───────────────────────────────────────────────
  "Parol kamida 6 belgi": { ru: "Пароль минимум 6 символов", en: "Password must be at least 6 characters" },
  "Parol kamida 6 ta belgi bo'lishi kerak": { ru: "Пароль должен быть минимум 6 символов", en: "Password must be at least 6 characters" },
  "Parol kamita 6 ta belgidan iborat bo'lsin": { ru: "Пароль должен быть минимум 6 символов", en: "Password must be at least 6 characters" },
  "Yangi parol kamida 6 ta belgi": { ru: "Новый пароль минимум 6 символов", en: "New password must be at least 6 characters" },
  "Yangi parol kamida 6 ta belgi bo'lishi kerak": { ru: "Новый пароль должен быть минимум 6 символов", en: "New password must be at least 6 characters" },
  "Joriy va yangi parol majburiy": { ru: "Текущий и новый пароль обязательны", en: "Current and new password are required" },
  "Joriy parol noto'g'ri": { ru: "Текущий пароль неверен", en: "Current password is wrong" },
  "Yangi parol joriysidan farq qilishi kerak": { ru: "Новый пароль должен отличаться от текущего", en: "The new password must differ from the current one" },
  "Parol muvaffaqiyatli yangilandi": { ru: "Пароль успешно обновлён", en: "Password updated successfully" },
  "Parol muvaffaqiyatli o'zgartirildi": { ru: "Пароль успешно изменён", en: "Password changed successfully" },
  "Parol muvaffaqiyatli yangilandi. Endi tizimga kirishingiz mumkin.": { ru: "Пароль успешно обновлён. Теперь вы можете войти.", en: "Password updated. You can sign in now." },
  "Token va yangi parol majburiy": { ru: "Токен и новый пароль обязательны", en: "Token and new password are required" },
  "Token noto'g'ri yoki muddati o'tgan (24 soat)": { ru: "Токен неверен или истёк (24 часа)", en: "Token is invalid or expired (24 hours)" },
  "Faqat direktor parol yangilaya oladi": { ru: "Только директор может обновить пароль", en: "Only the director can update the password" },

  // ── Ro'yxatdan o'tish / onboarding ──────────────────────
  "Ism majburiy": { ru: "Имя обязательно", en: "Name is required" },
  "Ism-familya majburiy": { ru: "Имя и фамилия обязательны", en: "First and last name are required" },
  "Ism, email va parol majburiy": { ru: "Имя, email и пароль обязательны", en: "Name, email and password are required" },
  "Ism, email va rol majburiy": { ru: "Имя, email и роль обязательны", en: "Name, email and role are required" },
  "Shahar/tuman majburiy": { ru: "Город/район обязателен", en: "City/district is required" },
  "O'quvchilar soni diapazoni noto'g'ri": { ru: "Неверный диапазон количества учеников", en: "Invalid student count range" },
  "Onboarding muvaffaqiyatli yakunlandi": { ru: "Настройка успешно завершена", en: "Onboarding completed successfully" },
  "Admin allaqachon mavjud": { ru: "Админ уже существует", en: "An admin already exists" },
  "Admin yaratildi": { ru: "Админ создан", en: "Admin created" },

  // ── Sinf / guruh ────────────────────────────────────────
  "Sinf nomi va oylik to'lov summasi majburiy": { ru: "Название класса и сумма ежемесячного взноса обязательны", en: "Class name and monthly fee are required" },
  "Sinf muvaffaqiyatli yaratildi": { ru: "Класс успешно создан", en: "Class created successfully" },
  "Sinf va barcha bog'liq ma'lumotlar o'chirildi": { ru: "Класс и все связанные данные удалены", en: "The class and all related data were deleted" },
  "Guruh nomi majburiy": { ru: "Название группы обязательно", en: "Group name is required" },
  "Guruh nomi bo'sh bo'lishi mumkin emas": { ru: "Название группы не может быть пустым", en: "Group name cannot be empty" },
  "Guruh yaratildi": { ru: "Группа создана", en: "Group created" },
  "Guruh yangilandi": { ru: "Группа обновлена", en: "Group updated" },
  "Guruh va bog'liq barcha ma'lumotlar o'chirildi": { ru: "Группа и все связанные данные удалены", en: "The group and all related data were deleted" },
  "Hali guruh yo'q": { ru: "Групп пока нет", en: "No groups yet" },
  "Narx to'g'ri kiritilmagan": { ru: "Цена указана неверно", en: "The price is not valid" },
  "Narx to'g'ri emas": { ru: "Цена неверна", en: "The price is not valid" },
  "Bu sinfda o'quvchi yo'q": { ru: "В этом классе нет учеников", en: "There are no students in this class" },
  "Boshlang'ich balans manfiy bo'lishi mumkin emas": { ru: "Начальный баланс не может быть отрицательным", en: "The initial balance cannot be negative" },
  "Balans 0 yoki undan katta bo'lishi kerak": { ru: "Баланс должен быть 0 или больше", en: "The balance must be 0 or greater" },
  "Boshlang'ich balans yangilandi": { ru: "Начальный баланс обновлён", en: "Initial balance updated" },
  "Default summa yangilandi": { ru: "Сумма по умолчанию обновлена", en: "Default amount updated" },

  // ── O'quvchi ────────────────────────────────────────────
  "O'quvchi ismi majburiy": { ru: "Имя ученика обязательно", en: "Student name is required" },
  "O'quvchi qo'shildi": { ru: "Ученик добавлен", en: "Student added" },
  "O'quvchi o'chirildi": { ru: "Ученик удалён", en: "Student deleted" },

  // ── Davomat / baho ──────────────────────────────────────
  "classId, date, records majburiy": { ru: "classId, date и records обязательны", en: "classId, date and records are required" },
  "classId, date, grades majburiy": { ru: "classId, date и grades обязательны", en: "classId, date and grades are required" },
  "date majburiy": { ru: "Дата обязательна", en: "Date is required" },
  "date: YYYY-MM-DD formatida bo'lsin": { ru: "Дата в формате ГГГГ-ММ-ДД", en: "Date must be in YYYY-MM-DD format" },
  "date: YYYY-MM-DD formatida": { ru: "Дата в формате ГГГГ-ММ-ДД", en: "Date in YYYY-MM-DD format" },
  "Baho o'chirildi": { ru: "Оценка удалена", en: "Grade deleted" },

  // ── Uy vazifasi ─────────────────────────────────────────
  "Guruh va sarlavha majburiy": { ru: "Группа и заголовок обязательны", en: "Group and title are required" },
  "Sana YYYY-MM-DD formatida bo'lsin": { ru: "Дата в формате ГГГГ-ММ-ДД", en: "Date must be in YYYY-MM-DD format" },
  "Topshirish sanasi berilgan sanadan oldin bo'lishi mumkin emas": { ru: "Срок сдачи не может быть раньше даты выдачи", en: "The due date cannot be before the assigned date" },
  "Vazifa yangilandi": { ru: "Задание обновлено", en: "Assignment updated" },
  "Vazifa o'chirildi": { ru: "Задание удалено", en: "Assignment deleted" },
  "records majburiy": { ru: "records обязательны", en: "records are required" },
  "Yuboriladigan ma'lumot yo'q": { ru: "Нет данных для отправки", en: "There is nothing to send" },

  // ── Lidlar ──────────────────────────────────────────────
  "Telefon raqam majburiy": { ru: "Номер телефона обязателен", en: "Phone number is required" },
  "Lid qo'shildi": { ru: "Лид добавлен", en: "Lead added" },
  "Lid yangilandi": { ru: "Лид обновлён", en: "Lead updated" },
  "Lid o'chirildi": { ru: "Лид удалён", en: "Lead deleted" },
  "Bu lid allaqachon o'quvchiga aylantirilgan": { ru: "Этот лид уже превращён в ученика", en: "This lead has already been converted to a student" },
  "'Yozildi' holati uchun lidni o'quvchiga aylantiring": { ru: "Для статуса «Записан» превратите лид в ученика", en: "Convert the lead to a student to use the 'Won' status" },
  "Guruhni tanlang (classId majburiy)": { ru: "Выберите группу (classId обязателен)", en: "Select a group (classId is required)" },
  "Noto'g'ri status": { ru: "Неверный статус", en: "Invalid status" },

  // ── Jadval ──────────────────────────────────────────────
  "classId, dayOfWeek, startTime, endTime majburiy": { ru: "classId, dayOfWeek, startTime и endTime обязательны", en: "classId, dayOfWeek, startTime and endTime are required" },
  "dayOfWeek 0-6 orasida bo'lishi kerak": { ru: "dayOfWeek должен быть от 0 до 6", en: "dayOfWeek must be between 0 and 6" },
  "Avval ustoz tayinlang (teacherId) — jadval ustozsiz yaratilmaydi": { ru: "Сначала назначьте преподавателя (teacherId) — без него расписание не создаётся", en: "Assign a teacher first (teacherId) — a schedule cannot be created without one" },
  "Jadval belgilash uchun avval ustoz tayinlang": { ru: "Сначала назначьте преподавателя, чтобы задать расписание", en: "Assign a teacher before setting the schedule" },
  "Jadval qo'shildi": { ru: "Расписание добавлено", en: "Schedule added" },
  "Jadval yangilandi": { ru: "Расписание обновлено", en: "Schedule updated" },
  "Jadval o'chirildi": { ru: "Расписание удалено", en: "Schedule deleted" },
  "Ustoz shu vaqtda boshqa guruhda band": { ru: "Преподаватель в это время занят в другой группе", en: "The teacher is busy with another group at that time" },
  "Ustoz guruhning jadvalidagi vaqt(lar)da band": { ru: "Преподаватель занят в часы расписания этой группы", en: "The teacher is busy during this group's scheduled time" },

  // ── Filiallar ───────────────────────────────────────────
  "Filial nomi majburiy": { ru: "Название филиала обязательно", en: "Branch name is required" },
  "Filial yaratildi": { ru: "Филиал создан", en: "Branch created" },
  "Filial yangilandi": { ru: "Филиал обновлён", en: "Branch updated" },
  "Filial o'chirildi. Sinflar saqlab qolindi.": { ru: "Филиал удалён. Классы сохранены.", en: "Branch deleted. Classes were kept." },
  'Faqat "Branch Manager" rolidagi xodim tayinlanishi mumkin': { ru: 'Назначить можно только сотрудника с ролью "Branch Manager"', en: 'Only a staff member with the "Branch Manager" role can be assigned' },
  "Branch Manager rolini faqat direktor tayinlay oladi": { ru: "Роль Branch Manager может назначить только директор", en: "Only the director can assign the Branch Manager role" },
  "Faqat direktor manager tayinlay oladi": { ru: "Только директор может назначить менеджера", en: "Only the director can assign a manager" },
  "Endi siz ham bu filial manageri hisoblanasiz": { ru: "Теперь вы тоже менеджер этого филиала", en: "You are now also a manager of this branch" },

  // ── Rollar ──────────────────────────────────────────────
  "Faqat direktor rol yarata oladi": { ru: "Только директор может создать роль", en: "Only the director can create a role" },
  "Faqat direktor rol yangilaya oladi": { ru: "Только директор может изменить роль", en: "Only the director can update a role" },
  "Faqat direktor rol o'chira oladi": { ru: "Только директор может удалить роль", en: "Only the director can delete a role" },
  "Rol nomi majburiy": { ru: "Название роли обязательно", en: "Role name is required" },
  "Bu nomli rol allaqachon mavjud": { ru: "Роль с таким названием уже существует", en: "A role with this name already exists" },
  "Default rolni o'zgartirish mumkin emas": { ru: "Роль по умолчанию нельзя изменить", en: "A default role cannot be changed" },
  "Default rolni o'chirish mumkin emas": { ru: "Роль по умолчанию нельзя удалить", en: "A default role cannot be deleted" },
  "Rol o'chirildi": { ru: "Роль удалена", en: "Role deleted" },

  // ── Maosh ───────────────────────────────────────────────
  "staffId, month va amount majburiy": { ru: "staffId, month и amount обязательны", en: "staffId, month and amount are required" },
  "Month formati: YYYY-MM (masalan: 2025-01)": { ru: "Формат месяца: ГГГГ-ММ (например: 2025-01)", en: "Month format: YYYY-MM (e.g. 2025-01)" },
  "month parametri majburiy": { ru: "Параметр month обязателен", en: "The month parameter is required" },
  "To'langan maoshni o'chirish mumkin emas": { ru: "Выплаченную зарплату нельзя удалить", en: "A paid salary cannot be deleted" },
  "Maosh yozuvi o'chirildi": { ru: "Запись о зарплате удалена", en: "Salary record deleted" },
  "Summa 0 dan katta bo'lishi kerak": { ru: "Сумма должна быть больше 0", en: "The amount must be greater than 0" },

  // ── To'lovlar ───────────────────────────────────────────
  "classId, month, year majburiy": { ru: "classId, month и year обязательны", en: "classId, month and year are required" },
  "Oy va yil noto'g'ri": { ru: "Месяц или год указаны неверно", en: "Month or year is invalid" },
  "Oy 1–12 orasida": { ru: "Месяц от 1 до 12", en: "Month must be between 1 and 12" },
  "Status 'paid' yoki 'not_paid' bo'lishi kerak": { ru: "Статус должен быть 'paid' или 'not_paid'", en: "Status must be 'paid' or 'not_paid'" },
  "Status yangilandi": { ru: "Статус обновлён", en: "Status updated" },

  // ── Xarajatlar ──────────────────────────────────────────
  "Barcha majburiy maydonlarni to'ldiring": { ru: "Заполните все обязательные поля", en: "Fill in all required fields" },
  "Xarajat qo'shildi": { ru: "Расход добавлен", en: "Expense added" },
  "Xarajat o'chirildi": { ru: "Расход удалён", en: "Expense deleted" },

  // ── Fanlar ──────────────────────────────────────────────
  "Fan nomi majburiy": { ru: "Название предмета обязательно", en: "Subject name is required" },
  "Bu nomli fan allaqachon mavjud": { ru: "Предмет с таким названием уже существует", en: "A subject with this name already exists" },
  "Fan o'chirildi": { ru: "Предмет удалён", en: "Subject deleted" },

  // ── Obuna / to'lov so'rovi ──────────────────────────────
  "Plan: free, pro yoki premium bo'lishi kerak": { ru: "Тариф: free, pro или premium", en: "Plan must be free, pro or premium" },
  "Plan: 'pro' yoki 'premium'": { ru: "Тариф: 'pro' или 'premium'", en: "Plan must be 'pro' or 'premium'" },
  "Screenshot (rasm) majburiy": { ru: "Скриншот (изображение) обязателен", en: "A screenshot (image) is required" },
  "Rasm hajmi 2MB dan oshmasligi kerak": { ru: "Размер изображения не должен превышать 2МБ", en: "The image must be under 2MB" },
  "Sizda allaqachon kutilayotgan so'rov mavjud. Admin ko'rib chiqsin.": { ru: "У вас уже есть заявка на рассмотрении. Дождитесь ответа админа.", en: "You already have a pending request. Please wait for the admin." },
  "So'rov yuborildi! Admin ko'rib chiqadi.": { ru: "Заявка отправлена! Админ рассмотрит её.", en: "Request sent! The admin will review it." },
  "So'rov rad etildi.": { ru: "Заявка отклонена.", en: "Request rejected." },
  "Bu so'rov allaqachon ko'rib chiqilgan": { ru: "Эта заявка уже рассмотрена", en: "This request has already been reviewed" },
  "Export faqat Premium uchun": { ru: "Экспорт только для Premium", en: "Export is Premium only" },
  "Bu funksiya Pro va Premium tarifda": { ru: "Эта функция доступна в тарифах Pro и Premium", en: "This feature is available on the Pro and Premium plans" },
  "SMS reminder faqat Premium uchun": { ru: "SMS-напоминание только для Premium", en: "SMS reminders are Premium only" },

  // ── Admin paneli ────────────────────────────────────────
  "Teacher muvaffaqiyatli qo'shildi": { ru: "Учитель успешно добавлен", en: "Teacher added successfully" },
  "Teacher muvaffaqiyatli bloklandi": { ru: "Учитель заблокирован", en: "Teacher blocked" },
  "Teacher faollandi": { ru: "Учитель активирован", en: "Teacher activated" },

  // ── Guruhga yozish (bir o'quvchi — bir nechta guruh) ────
  "studentId va classId majburiy": { ru: "studentId и classId обязательны", en: "studentId and classId are required" },
  "O'quvchi allaqachon shu guruhda": { ru: "Ученик уже в этой группе", en: "The student is already in this group" },
  "O'quvchi bu guruhda emas": { ru: "Ученика нет в этой группе", en: "The student is not in this group" },
  "Guruh to'lgan": { ru: "Группа заполнена", en: "The group is full" },
  "O'quvchi guruhga yozildi": { ru: "Ученик записан в группу", en: "Student enrolled in the group" },
  "O'quvchi guruhdan chiqarildi": { ru: "Ученик убран из группы", en: "Student removed from the group" },
  "Asosiy guruhdan chiqarib bo'lmaydi — o'quvchini o'chiring": { ru: "Из основной группы убрать нельзя — удалите ученика", en: "Cannot remove from the primary group — delete the student instead" },
  "Saqlandi": { ru: "Сохранено", en: "Saved" },

  // ── Muassasa brendi (white-label) ───────────────────────
  "Logotip rasm bo'lishi kerak": { ru: "Логотип должен быть изображением", en: "The logo must be an image" },
  "Logotip hajmi 300KB dan oshmasligi kerak": { ru: "Размер логотипа не должен превышать 300КБ", en: "The logo must be under 300KB" },
  "Rang formati noto'g'ri": { ru: "Неверный формат цвета", en: "Invalid colour format" },
  "Brend saqlandi": { ru: "Бренд сохранён", en: "Branding saved" },
  "Muassasa nomi majburiy": { ru: "Название учреждения обязательно", en: "Institution name is required" },

  "Logotip hajmi 3MB dan oshmasligi kerak": { ru: "Размер логотипа не должен превышать 3МБ", en: "The logo must be under 3MB" },
  "Logotipni yuklab bo'lmadi, birozdan keyin urinib ko'ring": { ru: "Не удалось загрузить логотип, попробуйте позже", en: "Could not upload the logo, please try again shortly" },
  "Rasm hajmi 5MB dan oshmasligi kerak": { ru: "Размер изображения не должен превышать 5МБ", en: "The image must be under 5MB" },
  "Chekni yuklab bo'lmadi, birozdan keyin urinib ko'ring": { ru: "Не удалось загрузить чек, попробуйте позже", en: "Could not upload the receipt, please try again shortly" },

  // ── Hisobni o'chirish ───────────────────────────────────
  "Parol majburiy": { ru: "Пароль обязателен", en: "Password is required" },
  "Parol noto'g'ri": { ru: "Неверный пароль", en: "Incorrect password" },
  "Hisob allaqachon o'chirish navbatida": { ru: "Аккаунт уже в очереди на удаление", en: "The account is already scheduled for deletion" },
  "Tiklab bo'lmadi — ma'lumotlarni tekshiring": { ru: "Не удалось восстановить — проверьте данные", en: "Could not restore — check your details" },
  "Tiklash muddati o'tib ketgan": { ru: "Срок восстановления истёк", en: "The restore window has expired" },
  "Hisob tiklandi — endi tizimga kirishingiz mumkin": { ru: "Аккаунт восстановлен — теперь вы можете войти", en: "Account restored — you can sign in now" },
  "Hisob o'chirish navbatida": { ru: "Аккаунт в очереди на удаление", en: "The account is scheduled for deletion" },
  "Muassasa hisobi o'chirilmoqda": { ru: "Аккаунт учреждения удаляется", en: "The institution's account is being deleted" },
  "Muassasa hisobi o'chirilmoqda. Direktor bilan bog'laning.": { ru: "Аккаунт учреждения удаляется. Свяжитесь с директором.", en: "The institution's account is being deleted. Contact the director." },

  // ── So'rov cheklagichi ──────────────────────────────────
  "Juda ko'p kirish urinishi. 15 daqiqadan keyin urinib ko'ring.": { ru: "Слишком много попыток входа. Повторите через 15 минут.", en: "Too many sign-in attempts. Try again in 15 minutes." },
  "Bu hisobga juda ko'p urinish bo'ldi. 15 daqiqadan keyin urining.": { ru: "Слишком много попыток для этого аккаунта. Повторите через 15 минут.", en: "Too many attempts for this account. Try again in 15 minutes." },
  "Juda ko'p so'rov. Bir soatdan keyin urinib ko'ring.": { ru: "Слишком много запросов. Повторите через час.", en: "Too many requests. Try again in an hour." },
  "Juda ko'p ro'yxatdan o'tish urinishi. Keyinroq urining.": { ru: "Слишком много попыток регистрации. Повторите позже.", en: "Too many sign-up attempts. Try again later." },
  "Juda ko'p fayl yuborildi. Birozdan keyin urinib ko'ring.": { ru: "Отправлено слишком много файлов. Повторите позже.", en: "Too many uploads. Try again shortly." },
  "Juda ko'p urinish. Bir soatdan keyin urinib ko'ring.": { ru: "Слишком много попыток. Повторите через час.", en: "Too many attempts. Try again in an hour." },
  "Parol o'zgargan — qaytadan tizimga kiring": { ru: "Пароль изменён — войдите заново", en: "Password changed — please sign in again" },

  // ── Mini App (ota-ona / o'quvchi) ───────────────────────
  "Bu o'quvchiga ruxsat yo'q": { ru: "Нет доступа к этому ученику", en: "No access to this student" },
  "Buni ko'rish uchun hisobingizni tasdiqlang": { ru: "Подтвердите аккаунт, чтобы увидеть это", en: "Verify your account to see this" },
  "Kod noto'g'ri yoki muddati o'tgan": { ru: "Код неверный или истёк", en: "The code is invalid or has expired" },
  "Kod noto'g'ri": { ru: "Неверный код", en: "Invalid code" },
  "Ulanish topilmadi": { ru: "Связь не найдена", en: "Link not found" },
  "Ulanish uzildi": { ru: "Связь разорвана", en: "Link removed" },

  // ── Qo'shimcha mashg'ulot (support booking) ─────────────
  "Ustoz tanlanmagan": { ru: "Преподаватель не выбран", en: "No teacher selected" },
  "Hafta kuni noto'g'ri": { ru: "Неверный день недели", en: "Invalid day of week" },
  "Vaqt HH:MM formatida bo'lsin": { ru: "Время в формате ЧЧ:ММ", en: "Time must be in HH:MM format" },
  "Tugash vaqti boshlanishdan keyin bo'lsin": { ru: "Время окончания должно быть позже начала", en: "The end time must be after the start time" },
  "Oraliq bitta uchrashuvga ham yetmaydi": { ru: "Интервал меньше одной встречи", en: "The window is shorter than one session" },
  "Qabul vaqti topilmadi": { ru: "Приёмное время не найдено", en: "Office hours not found" },
  "Holat noto'g'ri": { ru: "Неверный статус", en: "Invalid status" },
  "Yozuv topilmadi": { ru: "Запись не найдена", en: "Booking not found" },
  "Bu vaqt endi bo'sh emas": { ru: "Это время уже занято", en: "That time is no longer free" },
  "Bu haftaga allaqachon yozilgansiz. Avval uni bekor qiling.": { ru: "Вы уже записаны на эту неделю. Сначала отмените её.", en: "You already have a booking this week. Cancel it first." },
  "Bu yozuvni bekor qilib bo'lmaydi": { ru: "Эту запись нельзя отменить", en: "This booking cannot be cancelled" },
  "Bekor qilish uchun kamida 2 soat qolishi kerak": { ru: "Отменить можно не позднее чем за 2 часа", en: "Cancellation requires at least 2 hours' notice" },
  "Yozildingiz. Ustoz tasdiqlagach xabar keladi.": { ru: "Вы записаны. Придёт уведомление после подтверждения.", en: "Booked. You'll be notified once the teacher confirms." },
  "Bekor qilindi": { ru: "Отменено", en: "Cancelled" },
  "O'chirildi": { ru: "Удалено", en: "Deleted" },
  "teacherId va date majburiy": { ru: "teacherId и date обязательны", en: "teacherId and date are required" },
  "teacherId, date, startTime majburiy": { ru: "teacherId, date, startTime обязательны", en: "teacherId, date and startTime are required" },
  "studentId, teacherId, date, startTime majburiy": { ru: "studentId, teacherId, date, startTime обязательны", en: "studentId, teacherId, date and startTime are required" },
  "Juda ko'p urinish. Birozdan keyin urinib ko'ring.": { ru: "Слишком много попыток. Повторите позже.", en: "Too many attempts. Try again shortly." },

  "Bu markazda qo'shimcha mashg'ulot xizmati yo'q": { ru: "В этом центре нет услуги дополнительных занятий", en: "This centre does not offer support sessions" },
  "Bu yozuv uchun QR berilmaydi": { ru: "Для этой записи QR не выдаётся", en: "No QR is issued for this booking" },
  "Bu yozuv faol emas": { ru: "Эта запись неактивна", en: "This booking is not active" },
  "Bu yozuv sizniki emas": { ru: "Эта запись не ваша", en: "This booking is not yours" },
  "Kelganingiz belgilandi ✅": { ru: "Присутствие отмечено ✅", en: "Attendance recorded ✅" },
  "Allaqachon belgilangan": { ru: "Уже отмечено", en: "Already recorded" },
  "QR kod tanilmadi": { ru: "QR-код не распознан", en: "QR code not recognised" },
  "QR kod eskirgan — ustozdan yangisini so'rang": { ru: "QR-код устарел — попросите новый у преподавателя", en: "The QR code has expired — ask the teacher for a new one" },
  "Xizmat yoqildi": { ru: "Услуга включена", en: "Service enabled" },
  "Xizmat o'chirildi": { ru: "Услуга отключена", en: "Service disabled" },

  "institutionType: 'school' yoki 'learning_center' bo'lishi kerak": { ru: "institutionType должен быть 'school' или 'learning_center'", en: "institutionType must be 'school' or 'learning_center'" },
  "Rejim o'zgarmadi": { ru: "Режим не изменён", en: "Mode unchanged" },
  "O'quv markazi rejimiga o'tdingiz": { ru: "Вы перешли в режим учебного центра", en: "Switched to learning centre mode" },
  "Maktab fondi rejimiga o'tdingiz": { ru: "Вы перешли в режим школьного фонда", en: "Switched to school fund mode" },
  "Rejimni almashtirish uchun hisob bo'sh bo'lishi kerak. Avval sinf/guruh, o'quvchi va xodimlarni o'chiring.": { ru: "Для смены режима аккаунт должен быть пустым. Сначала удалите классы/группы, учеников и сотрудников.", en: "To switch mode the account must be empty. Remove classes/groups, students and staff first." },

  "Fayl juda katta": { ru: "Файл слишком большой", en: "File is too large" },
  "So'rov formati noto'g'ri": { ru: "Неверный формат запроса", en: "Malformed request" },
  // ── Telegram / SMS ──────────────────────────────────────
  "Bot ishlamayapti": { ru: "Бот не работает", en: "The bot is not running" },
  "Eslatmalar yuborildi": { ru: "Напоминания отправлены", en: "Reminders sent" },
  "SMS yuborilmaydigan o'quvchi yo'q": { ru: "Нет учеников для отправки SMS", en: "There are no students to send SMS to" },
  "SMS reminder yuborildi": { ru: "SMS-напоминание отправлено", en: "SMS reminder sent" },
  "studentIds bo'sh": { ru: "studentIds пуст", en: "studentIds is empty" },

  "Ism bo'sh bo'lmasin": { ru: "Имя не может быть пустым", en: "The name cannot be empty" },
  "Tarif chegarasi: bu guruhga ko'proq o'quvchi sig'maydi": { ru: "Ограничение тарифа: в эту группу больше учеников не поместится", en: "Plan limit: this group cannot take more students" },
  "O'zgarish yo'q": { ru: "Изменений нет", en: "Nothing changed" },
  // ── Excel import ───────────────────────────────────────
  "Faylni o'qib bo'lmadi": { ru: "Не удалось прочитать файл", en: "The file could not be read" },
  "Import tugadi": { ru: "Импорт завершён", en: "Import finished" },
  "Fayl bo'sh": { ru: "Файл пустой", en: "The file is empty" },
  "Ism ustuni topilmadi": { ru: "Столбец с именем не найден", en: "No name column found" },
  "Faylda varaq yo'q": { ru: "В файле нет листов", en: "The file has no sheets" },
  // ── Tarif chegaralari ──────────────────────────────────
  // ⚠️ Raqam matnda EMAS — javobdagi `limit` maydonida.
  //    Shablonli xabar tarjima qilinmaydi va ruscha
  //    interfeysda o'zbekcha chiqib qolardi.
  "Tarif chegarasi: bu rejada ko'proq xodim qo'shib bo'lmaydi": { ru: "Ограничение тарифа: на этом плане больше сотрудников добавить нельзя", en: "Plan limit: this plan does not allow more staff" },
  "Tarif chegarasi: bu rejada ko'proq filial ochib bo'lmaydi": { ru: "Ограничение тарифа: на этом плане больше филиалов открыть нельзя", en: "Plan limit: this plan does not allow more branches" },
  "Tarif chegarasi: bu rejada ko'proq ochiq lid saqlab bo'lmaydi": { ru: "Ограничение тарифа: на этом плане больше открытых лидов держать нельзя", en: "Plan limit: this plan does not allow more open leads" },

  // ── 2026-08-21 da qo'shilgan: qolgan tarjimasiz xabarlar ──
  // Ular foydalanuvchi ko'radigan xato matnlari edi va ruscha
  // interfeysda jimgina o'zbekcha chiqardi.
  "Sana noto'g'ri — YYYY-MM-DD kutilgan": { ru: "Неверная дата — ожидается YYYY-MM-DD", en: "Invalid date — YYYY-MM-DD expected" },
  "Kelajakdagi kunni yopib bo'lmaydi": { ru: "Будущий день закрыть нельзя", en: "A future day cannot be closed" },
  "Sanalgan naqd pul noto'g'ri": { ru: "Пересчитанная наличность указана неверно", en: "The counted cash amount is invalid" },
  "Bu kun allaqachon yopilgan": { ru: "Этот день уже закрыт", en: "This day is already closed" },
  "Qaror: 'confirmed' yoki 'rejected'": { ru: "Решение: 'confirmed' или 'rejected'", en: "Decision must be 'confirmed' or 'rejected'" },
  "Karta raqami 16 xonali bo'lishi kerak": { ru: "Номер карты должен состоять из 16 цифр", en: "The card number must be 16 digits" },
  "Oy yoki yil noto'g'ri": { ru: "Неверный месяц или год", en: "Invalid month or year" },
  "Bu oy uchun to'lov varaqasi yaratilmagan. Markazga murojaat qiling.": { ru: "Счёт за этот месяц ещё не выставлен. Обратитесь в центр.", en: "No bill has been issued for this month. Please contact the centre." },
  "Bu oy allaqachon to'langan": { ru: "Этот месяц уже оплачен", en: "This month is already paid" },
  "Bu oy uchun to'lovingiz allaqachon tekshirilmoqda": { ru: "Ваш платёж за этот месяц уже проверяется", en: "Your payment for this month is already being reviewed" },
  "Yuborildi. Markaz tasdiqlagach qarz yopiladi.": { ru: "Отправлено. Долг закроется после подтверждения центром.", en: "Sent. The balance clears once the centre confirms." },
  "Oy formati: YYYY-MM": { ru: "Формат месяца: YYYY-MM", en: "Month format: YYYY-MM" },
  "Foiz 0–100 oralig'ida": { ru: "Процент — от 0 до 100", en: "The percentage must be between 0 and 100" },
  "Summa manfiy bo'lmasin": { ru: "Сумма не может быть отрицательной", en: "The amount cannot be negative" },
  "Bu sozlamani direktor yoki filial boshqaruvchisi o'zgartiradi": { ru: "Эту настройку меняет директор или руководитель филиала", en: "Only the director or a branch manager can change this setting" },
  "Kechikish chegarasi 0–60 daqiqa oralig'ida": { ru: "Порог опоздания — от 0 до 60 минут", en: "The lateness threshold must be between 0 and 60 minutes" },
  "Sana noto'g'ri": { ru: "Неверная дата", en: "Invalid date" },
  "Xodim tanlanmagan": { ru: "Сотрудник не выбран", en: "No staff member selected" },
  "Oy noto'g'ri": { ru: "Неверный месяц", en: "Invalid month" },
  "Uchrashuv davomiyligi 10–120 daqiqa oralig'ida": { ru: "Длительность встречи — от 10 до 120 минут", en: "A session must last between 10 and 120 minutes" },
  "Ish vaqti bitta uchrashuvga ham yetmaydi": { ru: "Рабочего времени не хватает даже на одну встречу", en: "The working window is too short for even one session" },
  "Kamida bitta ish kuni tanlansin": { ru: "Выберите хотя бы один рабочий день", en: "Select at least one working day" },
  "Bugunga yozilib bo'lmaydi — eng erta ertangi kunga": { ru: "На сегодня записаться нельзя — самое раннее на завтра", en: "Today cannot be booked — tomorrow is the earliest" },
  "Mavzuni yozing — ustoz shunga tayyorlanadi": { ru: "Напишите тему — преподаватель подготовится к ней", en: "Write the topic — the teacher prepares for it" },
  "Bu xodim qo'shimcha mashg'ulot o'tkazmaydi": { ru: "Этот сотрудник не проводит дополнительные занятия", en: "This staff member does not run support sessions" },
  "Belgilandi": { ru: "Отмечено", en: "Marked" },
  "Xabar turi noto'g'ri": { ru: "Неверный тип сообщения", en: "Invalid message type" },
  "Telegram ulanmagan": { ru: "Telegram не подключён", en: "Telegram is not connected" },
  "Bot bloklangan — Telegram'da botni oching va qayta ulaning": { ru: "Бот заблокирован — откройте бота в Telegram и подключитесь заново", en: "The bot is blocked — open it in Telegram and connect again" },
  "Yuborildi": { ru: "Отправлено", en: "Sent" },
};

module.exports = { MESSAGES };
