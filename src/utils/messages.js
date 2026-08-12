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
  "Baho topilmadi": { ru: "Оценка не найдена", en: "Grade not found" },
  "Aktiv freeze topilmadi": { ru: "Активная заморозка не найдена", en: "No active freeze found" },
  "Referral kod topilmadi": { ru: "Реферальный код не найден", en: "Referral code not found" },
  "Xarajat topilmadi yoki ruxsat yo'q": { ru: "Расход не найден или нет доступа", en: "Expense not found or no permission" },

  // ── Filial cheklovi ─────────────────────────────────────
  "Bu sinf sizning filialingizga tegishli emas": { ru: "Этот класс не относится к вашему филиалу", en: "This class does not belong to your branch" },
  "Bu guruh sizning filialingizga tegishli emas": { ru: "Эта группа не относится к вашему филиалу", en: "This group does not belong to your branch" },
  "Faqat o'z filialingizga xodim qo'sha olasiz": { ru: "Вы можете добавлять сотрудников только в свой филиал", en: "You can only add staff to your own branch" },
  "Filial ko'rsatilmagan": { ru: "Филиал не указан", en: "Branch not specified" },

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

  // ── Telegram / SMS ──────────────────────────────────────
  "Bot ishlamayapti": { ru: "Бот не работает", en: "The bot is not running" },
  "Eslatmalar yuborildi": { ru: "Напоминания отправлены", en: "Reminders sent" },
  "SMS yuborilmaydigan o'quvchi yo'q": { ru: "Нет учеников для отправки SMS", en: "There are no students to send SMS to" },
  "SMS reminder yuborildi": { ru: "SMS-напоминание отправлено", en: "SMS reminder sent" },
  "studentIds bo'sh": { ru: "studentIds пуст", en: "studentIds is empty" },
};

module.exports = { MESSAGES };
