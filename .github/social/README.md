# النشر الآلي على المنصات

ينشر سير العمل `social` كل عشر دقائق ما حان موعده من إصدارات المحتوى المذكورة في `config.json`، على فيسبوك وإنستغرام مباشرة عبر واجهات Meta الرسمية، دون متصفح ودون أي محادثة. ويحفظ ما نُشر في `published.json` ضمن الإصدار `social-log`، فلا يُنشر عنصر مرتين.

## الإعداد مرة واحدة (نحو 20 دقيقة)

### 1. تطبيق Meta
1. افتح `developers.facebook.com`، ثم **My Apps**، ثم **Create App**. اختر نوع **Business**، واسم التطبيق `Cairo Quran Publisher`.
2. افتح **Graph API Explorer** من قائمة **Tools**، واختر التطبيق نفسه.
3. اختر **Get User Access Token**، وأضف هذه الصلاحيات:
   `pages_show_list`، `pages_read_engagement`، `pages_read_user_content`، `pages_manage_posts`، `read_insights`، `instagram_basic`، `instagram_content_publish`، `instagram_manage_insights`، `business_management`.
   صلاحيات `read_insights` و`instagram_manage_insights` و`pages_read_user_content` يحتاجها التقرير اليومي لقراءة الأرقام.
4. اضغط **Generate Access Token**، ووافق على صفحة Cairo Quran وحساب إنستغرام.
5. افتح **Access Token Debugger** من قائمة **Tools**، والصق الرمز، ثم **Extend Access Token** في أسفل الصفحة، وانسخ الرمز الطويل.
6. عُد إلى **Graph API Explorer**، والصق الرمز الطويل، ونفّذ الطلب `me/accounts`. من نتيجة صفحة Cairo Quran انسخ:
   - `access_token`: هو رمز الصفحة، ولا تنتهي صلاحيته.
   - `id`: هو رقم الصفحة.
7. نفّذ الطلب `<رقم الصفحة>?fields=instagram_business_account`، وانسخ `id` الظاهر: هو رقم حساب إنستغرام.

### 2. إضافة الأسرار في GitHub
من المستودع: **Settings**، ثم **Secrets and variables**، ثم **Actions**، ثم **New repository secret**. أضف ثلاثة أسرار:

| الاسم | القيمة |
|---|---|
| `META_TOKEN` | رمز الصفحة من الخطوة 6 |
| `FB_PAGE_ID` | رقم الصفحة |
| `IG_USER_ID` | رقم حساب إنستغرام |

لا تُكتب هذه القيم في أي مكان آخر: لا في محادثة، ولا في تعليق، ولا في ملف.

### 3. مفتاح يوتيوب للأرقام العامة (اختياري، 5 دقائق)
1. افتح `console.cloud.google.com`، وأنشئ مشروعًا باسم `Cairo Quran`.
2. من **APIs & Services**، ثم **Library**، فعّل **YouTube Data API v3**.
3. من **Credentials**، اختر **Create credentials**، ثم **API key**، وانسخ المفتاح.
4. أضفه سرًّا في GitHub باسم `YT_API_KEY`.

هذا المفتاح يقرأ الأرقام العامة فقط: المشتركين، والمشاهدات، والإعجابات. لا ينشر شيئًا.

### 4. التحقق
من **Actions**، ثم **social**، ثم **Run workflow**، والوضع `check`. تظهر في السجل:
- اسم الصفحة واسم حساب إنستغرام.
- ما سيُنشر خلال 24 ساعة.

لا يُنشر شيء في هذا الوضع.

## التشغيل اليومي
- **الأسابيع الجديدة:** تُنشر تلقائيًا. كل إصدار باسم `content-<تاريخ>` يساوي `from` في `config.json` أو يليه يُنشر في مواعيده، دون أي تعديل هنا.
- **استبعاد أسبوع:** أسبوع جُدول يدويًا يُضاف وسمه إلى `exclude`.
- **منع التكرار:** لا يُجدول يدويًا في Business Suite أي إصدار يشمله النشر الآلي.
- **التأخير:** يتأخر النشر بين 5 و20 دقيقة عن الموعد، بحسب جدولة GitHub.
- **العناصر المتأخرة:** العنصر الذي تجاوز موعده 6 ساعات لا يُنشر، ويُسجَّل «متأخر».
- **الإيقاف الطارئ:** `"dry_run": true` في `config.json`، أو تعطيل سير العمل من صفحة **Actions**.

## يوتيوب
الكود جاهز، لكنه معطّل في `config.json`. السبب أن Google تجعل كل فيديو يُرفع عبر الواجهة البرمجية من مشروع غير مُراجَع **خاصًا** لا يراه أحد، إلى أن تكتمل مراجعة المشروع (YouTube API Audit). يُفعَّل بعد المراجعة بإضافة `youtube` إلى `platforms` وأسرار `YT_CLIENT_ID` و`YT_CLIENT_SECRET` و`YT_REFRESH_TOKEN`.

## التقرير اليومي (`insights`)
- يعمل كل يوم الساعة 6:07 صباحًا بتوقيت الكويت.
- يحفظ أرقام فيسبوك وإنستغرام ويوتيوب في الإصدار `insights`:
  - `latest.json`: أحدث لقطة.
  - ملف لكل يوم.
  - `history.json`: المتابعون يومًا بيوم.
- يستخدم الأسرار نفسها، ويضاف إليها `YT_API_KEY`.
- **تيك توك:** لا يتيح واجهة برمجية دون مراجعة، فتُكتب أرقامه يدويًا في issue #4.
