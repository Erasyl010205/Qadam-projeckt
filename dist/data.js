import { pythonContent } from './content/python.js';
import { javaContent } from './content/java.js';

// Public lesson content. These are knowledge checks, not hidden code test cases.
export const courses = [
  {
    id: 'python', title: 'Python негіздері', language: 'Python',
    description: 'Алғашқы айнымалыдан алғашқы алгоритмге дейін. Қысқа сабақтар мен өз бетіңше жазатын тапсырмалар.',
    tag: 'Бастаушыға', duration: '1 сағ 20 мин', color: 'yellow',
    lessons: [
      {
        id: 'py-variables', title: 'Айнымалылар және типтер', module: '01 · Алғашқы қадам', minutes: 8, xp: 50,
        body: ['Айнымалы — мәнге берілген атау. Python-да типті алдын ала жазбаймыз: бүтін сан int, бөлшек сан float, мәтін str, ал ақиқат не жалған мән bool болады.', 'Мағыналы атау таңда: student_name түсінікті, ал x әрдайым түсінікті бола бермейді. Мәтінді тырнақшаға аламыз.'],
        example: 'student_name = "Айша"\nage = 18\nprogress = 0.75\nis_learning = True\nprint(student_name, age)',
        starter: '# Өз атың мен жасыңды сақта\nname = ""\nage = 0\n\n# Екі мәнді экранға шығар\n',
        question: 'Қай мәннің типі str болады?', options: ['42', '"42"', '4.2', 'True'], answer: 1,
        explanation: '"42" тырнақшада жазылған, сондықтан ол санға ұқсағанымен мәтін болып саналады.',
        task: 'name айнымалысына атыңды, age айнымалысына жасыңды жаз. Екеуін бір print арқылы шығар.'
      },
      {
        id: 'py-input', title: 'Енгізу және шығару', module: '01 · Алғашқы қадам', minutes: 8, xp: 50,
        body: ['print() мәндерді экранға шығарады. input() қолданушының енгізген жауабын мәтін ретінде қайтарады.', 'Егер енгізілген мәнмен есептеу керек болса, int() не float() арқылы түрлендір. f-жол мәтіннің ішіне айнымалы мәнін ыңғайлы орналастырады.'],
        example: 'name = input("Атың кім? ")\nage = int(input("Жасың нешеде? "))\nprint(f"Сәлем, {name}! Келесі жылы {age + 1} жастасың.")',
        starter: 'name = input("Атың: ")\n# Сәлемдесу хабарламасын жаз\n',
        question: 'input() функциясы әдетте қандай тип қайтарады?', options: ['int', 'float', 'str', 'bool'], answer: 2,
        explanation: 'input() әрқашан мәтін қайтарады. Сан керек болса, оны бөлек түрлендіреміз.',
        task: 'Екі бүтін санды input() арқылы алып, олардың қосындысын шығар.'
      },
      {
        id: 'py-conditions', title: 'Шарттармен шешім қабылдау', module: '02 · Бағдарлама логикасы', minutes: 9, xp: 60,
        body: ['if шарты ақиқат болса, оның ішіндегі код орындалады. elif келесі шартты тексереді, ал else қалған жағдайларды қамтиды.', 'Python-да шегініс код блогын анықтайды. == салыстырады, ал = мән тағайындайды. Шарт соңына қос нүкте қойылады.'],
        example: 'score = 85\nif score >= 90:\n    print("Өте жақсы")\nelif score >= 70:\n    print("Жақсы")\nelse:\n    print("Тағы жаттығайық")',
        starter: 'number = 12\n# Сан жұп болса «Жұп», әйтпесе «Тақ» деп шығар\n',
        question: 'Екі мәннің теңдігін қандай оператор тексереді?', options: ['=', '==', '!=', '>='], answer: 1,
        explanation: '== теңдікті тексереді. Мысалы, 4 == 4 нәтижесі True болады.',
        task: 'number % 2 өрнегін қолданып, санның жұп не тақ екенін анықта.'
      },
      {
        id: 'py-loops', title: 'Циклдер: қайталауды жеңілдет', module: '02 · Бағдарлама логикасы', minutes: 10, xp: 60,
        body: ['for тізім не range() сияқты реттіліктің элементтерімен жүреді. while берілген шарт ақиқат болғанша қайталанады.', 'range(1, 6) 1, 2, 3, 4, 5 сандарын береді: соңғы шекара кірмейді. Қосынды жинағанда бастапқы мәнді циклге дейін анықта.'],
        example: 'total = 0\nfor number in range(1, 6):\n    total += number\nprint(total)  # 15',
        starter: 'total = 0\n# 1-ден 10-ға дейінгі сандарды қос\n\nprint(total)',
        question: 'list(range(1, 4)) нәтижесі қандай?', options: ['[1, 2, 3, 4]', '[0, 1, 2, 3]', '[1, 2, 3]', '[1, 4]'], answer: 2,
        explanation: 'range() соңғы шекараны қоспайды, сондықтан нәтиже 1, 2, 3 болады.',
        task: 'for циклін қолданып, 1-ден 10-ға дейінгі сандардың қосындысын есепте. Нәтиже 55 болуы тиіс.'
      },
      {
        id: 'py-lists', title: 'Тізімдермен жұмыс', module: '03 · Деректер мен функциялар', minutes: 10, xp: 70,
        body: ['list бірнеше мәнді бір жерде сақтайды. Бірінші элементтің индексі 0. len() элементтер санын қайтарады.', 'append() жаңа элемент қосады. for циклімен тізімдегі әр мәнді өңдеуге болады. Бос тізімге индекс арқылы жүгінбе.'],
        example: 'scores = [70, 85, 90]\nscores.append(95)\nprint(scores[0])  # 70\nprint(len(scores))  # 4\nprint(sum(scores))  # 340',
        starter: 'scores = [75, 90, 60, 85]\n# Барлық ұпайдың орташа мәнін есепте\n',
        question: 'items = [10, 20, 30] болса, items[1] нешеге тең?', options: ['10', '20', '30', '1'], answer: 1,
        explanation: 'Индекстер нөлден басталады: items[0] = 10, items[1] = 20.',
        task: 'scores тізіміндегі ұпайлардың орташа мәнін sum() және len() арқылы есепте.'
      },
      {
        id: 'py-functions', title: 'Өз функцияңды жаз', module: '03 · Деректер мен функциялар', minutes: 10, xp: 70,
        body: ['Функция қайталанатын әрекетке атау береді. def арқылы анықтаймыз, параметрлер арқылы мән қабылдаймыз.', 'return нәтижені шақырған жерге қайтарады. print тек экранға жазады. Қайтарылған нәтижені басқа есептеуде пайдалануға болады.'],
        example: 'def square(number):\n    return number * number\n\nresult = square(5)\nprint(result)  # 25',
        starter: 'def is_even(number):\n    # Жұп сан үшін True қайтар\n    pass\n\nprint(is_even(8))',
        question: 'Функция нәтижесін қай сөз қайтарады?', options: ['print', 'input', 'return', 'for'], answer: 2,
        explanation: 'return функцияның орындалуын аяқтап, нәтижені шақырған жерге қайтарады.',
        task: 'is_even(number) функциясын жаз. Ол жұп санға True, тақ санға False қайтарсын.'
      },
      {
        id: 'py-dictionaries', title: 'Сөздіктер: кілт пен мән', module: '03 · Деректер мен функциялар', minutes: 10, xp: 70,
        body: ['dict деректерді кілт–мән жұптары ретінде сақтайды. Мысалы, қолданушының аты мен ұпайын бір объектіде жинай аламыз.', 'profile["name"] бар кілттің мәнін алады. get() кілт жоқ болса, әдепкі мән беруге мүмкіндік жасайды. Бір сөздіктегі кілттер бірегей болады.'],
        example: 'profile = {"name": "Айша", "xp": 120}\nprofile["xp"] += 50\nprint(profile["name"])\nprint(profile.get("streak", 0))',
        starter: 'student = {"name": "Дана", "score": 80}\n# score мәнін 10-ға арттыр да, нәтижені шығар\n',
        question: 'profile.get("level", 1) level кілті жоқ кезде не қайтарады?', options: ['Қате', 'None', '0', '1'], answer: 3,
        explanation: 'get() екінші аргументті әдепкі мән ретінде қолданады. Бұл жерде ол 1.',
        task: 'student сөздігіндегі score мәнін 10-ға арттыр. Аты мен жаңа ұпайын экранға шығар.'
      },
      {
        id: 'py-algorithms', title: 'Алғашқы алгоритм: максимум', module: '04 · Алгоритмге қадам', minutes: 15, xp: 100,
        body: ['Алгоритм — есепті шешетін нақты қадамдар. Ең үлкен санды табу үшін алғашқы элементті уақытша максимум деп алып, қалғандарымен салыстырамыз.', 'Бұл тәсіл тізімді бір рет аралайды: n элемент үшін шамамен n салыстыру керек. Бос тізімнің жағдайын алдын ала қарастыр.'],
        example: 'def find_max(numbers):\n    if not numbers:\n        return None\n    largest = numbers[0]\n    for number in numbers[1:]:\n        if number > largest:\n            largest = number\n    return largest\n\nprint(find_max([3, 9, 2, 7]))  # 9',
        starter: 'def find_min(numbers):\n    if not numbers:\n        return None\n    # Ең кіші санды циклмен тап\n\nprint(find_min([4, -2, 8, 1]))',
        question: 'n элементті бір рет аралайтын алгоритмнің уақыт күрделілігі қандай?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], answer: 2,
        explanation: 'Әр элемент бір рет қаралады, сондықтан жұмыс көлемі элементтер санына пропорционал: O(n).',
        task: 'min() қолданбай, find_min(numbers) функциясын жаз. Бос тізімге None қайтар.'
      }
    ]
  },
  {
    id: 'java', title: 'Java негіздері', language: 'Java',
    description: 'Типтерді түсін, әдістер құр, объектілермен таныс және алғашқы алгоритмді іске асыр.',
    tag: 'Бастаушыға', duration: '1 сағ 30 мин', color: 'blue',
    lessons: [
      {
        id: 'java-variables', title: 'Айнымалылар және дерек типтері', module: '01 · Java-ға кіріспе', minutes: 9, xp: 50,
        body: ['Java-да айнымалының типі атауының алдында жазылады. int бүтін санды, double бөлшек санды, boolean логикалық мәнді, String мәтінді сақтайды.', 'Көп нұсқау нүктелі үтірмен аяқталады. main әдісі — қарапайым Java бағдарламасының басталу нүктесі.'],
        example: 'public class Main {\n    public static void main(String[] args) {\n        String name = "Айша";\n        int age = 18;\n        double progress = 0.75;\n        boolean learning = true;\n        System.out.println(name + ": " + age);\n    }\n}',
        starter: 'public class Main {\n    public static void main(String[] args) {\n        // Атың мен жасыңды айнымалыларға сақта\n    }\n}',
        question: 'Java-да логикалық мәнді қай тип сақтайды?', options: ['String', 'int', 'boolean', 'double'], answer: 2,
        explanation: 'boolean тек true немесе false мәнін сақтайды.',
        task: 'String name және int age айнымалыларын жаса. Екеуін System.out.println арқылы шығар.'
      },
      {
        id: 'java-input', title: 'Консольге енгізу және шығару', module: '01 · Java-ға кіріспе', minutes: 10, xp: 50,
        body: ['System.out.println() мәтінді шығарып, жаңа жолға өтеді. System.out.print() жаңа жол қоспайды.', 'Scanner консольден мән оқиды. nextInt() бүтін санды, nextLine() мәтін жолын алады. Scanner қолдану үшін java.util.Scanner импортталады.'],
        example: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner input = new Scanner(System.in);\n        System.out.print("Жасың: ");\n        int age = input.nextInt();\n        System.out.println(age + 1);\n    }\n}',
        starter: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner input = new Scanner(System.in);\n        // Екі бүтін санды оқып, қосындысын шығар\n    }\n}',
        question: 'Scanner-дің қай әдісі бүтін сан оқиды?', options: ['nextLine()', 'nextInt()', 'println()', 'length()'], answer: 1,
        explanation: 'nextInt() енгізілген мәнді int типі ретінде оқиды.',
        task: 'Scanner арқылы екі int санын алып, олардың қосындысын шығар.'
      },
      {
        id: 'java-conditions', title: 'Шарттар және салыстыру', module: '02 · Логика және қайталау', minutes: 10, xp: 60,
        body: ['if шартын дөңгелек жақшаға жазамыз. Шарт ақиқат болса, фигуралы жақша ішіндегі блок орындалады. else балама әрекетті береді.', 'Сандарды == арқылы салыстырамыз. String мәтіндерінің мазмұнын салыстыру үшін equals() әдісін қолданамыз.'],
        example: 'public class Main {\n    public static void main(String[] args) {\n        int score = 85;\n        if (score >= 70) {\n            System.out.println("Өттің!");\n        } else {\n            System.out.println("Қайта жаттық");\n        }\n    }\n}',
        starter: 'public class Main {\n    public static void main(String[] args) {\n        int number = 12;\n        // Жұп немесе тақ екенін шығар\n    }\n}',
        question: 'Екі String мәнінің мазмұнын салыстыруға не қолданамыз?', options: ['=', '==', 'equals()', 'compareInt()'], answer: 2,
        explanation: 'equals() String мәндерінің мазмұнын салыстырады. == объектілердің сілтемелерін салыстыруы мүмкін.',
        task: 'number % 2 арқылы санның жұп не тақ екенін анықтайтын шарт жаз.'
      },
      {
        id: 'java-loops', title: 'for және while циклдері', module: '02 · Логика және қайталау', minutes: 10, xp: 60,
        body: ['for циклінде бастапқы мән, жалғасу шарты және әр қадамдағы өзгеріс беріледі. Цикл шарты әр қайталаудың алдында тексеріледі.', 'while шарты орындалғанша қайталанады. Шартты өзгертуді ұмытсаң, шексіз цикл пайда болуы мүмкін.'],
        example: 'public class Main {\n    public static void main(String[] args) {\n        int total = 0;\n        for (int i = 1; i <= 5; i++) {\n            total += i;\n        }\n        System.out.println(total); // 15\n    }\n}',
        starter: 'public class Main {\n    public static void main(String[] args) {\n        int total = 0;\n        // 1-ден 10-ға дейінгі сандарды қос\n        System.out.println(total);\n    }\n}',
        question: 'for (int i = 0; i < 3; i++) неше рет орындалады?', options: ['2', '3', '4', 'Шексіз'], answer: 1,
        explanation: 'Цикл i мәндері 0, 1, 2 болғанда орындалады: барлығы 3 рет.',
        task: 'for циклін қолданып, 1-ден 10-ға дейінгі сандардың қосындысын есепте.'
      },
      {
        id: 'java-arrays', title: 'Массивтер: мәндер жинағы', module: '03 · Код құрылымы', minutes: 10, xp: 70,
        body: ['Массив бір типтегі бірнеше мәнді сақтайды. Оның ұзындығы жасалғаннан кейін өзгермейді, индекстері нөлден басталады.', 'length қасиеті элементтер санын береді. Соңғы дұрыс индекс — length - 1. Массив шегінен шығу қате туғызады.'],
        example: 'public class Main {\n    public static void main(String[] args) {\n        int[] scores = {70, 85, 90};\n        int total = 0;\n        for (int score : scores) {\n            total += score;\n        }\n        System.out.println(total);\n    }\n}',
        starter: 'public class Main {\n    public static void main(String[] args) {\n        int[] numbers = {3, 6, 9, 12};\n        // Массивтің әр элементін шығар\n    }\n}',
        question: '5 элементтен тұратын массивтің соңғы дұрыс индексі қандай?', options: ['3', '4', '5', '6'], answer: 1,
        explanation: 'Индекстер 0-ден басталады. Бес элементтің индекстері 0, 1, 2, 3, 4.',
        task: 'numbers массивіндегі барлық элементті цикл арқылы бөлек жолдарға шығар.'
      },
      {
        id: 'java-methods', title: 'Әдістерді құрастыру', module: '03 · Код құрылымы', minutes: 12, xp: 70,
        body: ['Әдіс әрекетке атау береді. Қайтарылатын мәннің типі әдіс атауының алдында жазылады. Параметрлер кіріс деректерін қабылдайды.', 'void әдісі мән қайтармайды. int сияқты типі бар әдіс return арқылы сәйкес нәтиже қайтарады. main ішінен static әдісті тікелей шақыруға болады.'],
        example: 'public class Main {\n    static int square(int number) {\n        return number * number;\n    }\n\n    public static void main(String[] args) {\n        System.out.println(square(5)); // 25\n    }\n}',
        starter: 'public class Main {\n    static boolean isEven(int number) {\n        // Жұп санға true қайтар\n        return false;\n    }\n\n    public static void main(String[] args) {\n        System.out.println(isEven(8));\n    }\n}',
        question: 'Мән қайтармайтын әдістің типі қандай?', options: ['int', 'String', 'boolean', 'void'], answer: 3,
        explanation: 'void әдіс нәтиже мәнін қайтармайтынын білдіреді.',
        task: 'isEven(int number) әдісін аяқта. Жұп санға true, тақ санға false қайтарсын.'
      },
      {
        id: 'java-oop', title: 'Класс және объект', module: '03 · Код құрылымы', minutes: 14, xp: 80,
        body: ['Класс — деректер мен әрекеттердің үлгісі. Объект — сол үлгі бойынша жасалған нақты дана. Өрістер деректерді, әдістер әрекеттерді сипаттайды.', 'new арқылы жаңа объект жасаймыз. Конструктор бастапқы мәндерді орнатады. this ағымдағы объектіні білдіреді.'],
        example: 'class Student {\n    String name;\n\n    Student(String name) {\n        this.name = name;\n    }\n\n    void greet() {\n        System.out.println("Сәлем, " + name);\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Student student = new Student("Дана");\n        student.greet();\n    }\n}',
        starter: 'class Student {\n    String name;\n    int xp;\n    // name және xp қабылдайтын конструктор жаз\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        // Student объектісін жаса\n    }\n}',
        question: 'Java-да жаңа объект жасауға қай сөз қолданылады?', options: ['class', 'new', 'return', 'static'], answer: 1,
        explanation: 'new кілт сөзі конструкторды шақырып, жаңа объект жасайды.',
        task: 'Student класына name пен xp өрістерін орнататын конструктор жаз. main ішінде бір Student жаса.'
      },
      {
        id: 'java-algorithms', title: 'Сызықтық іздеу алгоритмі', module: '04 · Алгоритмге қадам', minutes: 15, xp: 100,
        body: ['Сызықтық іздеу массивті басынан соңына дейін қарайды. Қажетті мән табылса, оның индексін қайтарады.', 'Мән табылмаса, -1 қайтаруға болады. Ең нашар жағдайда барлық n элемент тексеріледі, сондықтан уақыт күрделілігі O(n).'],
        example: 'public class Main {\n    static int find(int[] values, int target) {\n        for (int i = 0; i < values.length; i++) {\n            if (values[i] == target) return i;\n        }\n        return -1;\n    }\n\n    public static void main(String[] args) {\n        System.out.println(find(new int[]{4, 7, 2}, 7)); // 1\n    }\n}',
        starter: 'public class Main {\n    static int find(int[] values, int target) {\n        // target мәнінің алғашқы индексін тап\n        return -1;\n    }\n\n    public static void main(String[] args) {\n        System.out.println(find(new int[]{8, 3, 9, 3}, 3));\n    }\n}',
        question: 'Сызықтық іздеу мәнді таппаса, мысалдағы әдіс не қайтарады?', options: ['0', 'null', '-1', 'Массивтің ұзындығын'], answer: 2,
        explanation: '-1 дұрыс индекс болмағандықтан, оны «табылмады» белгісі ретінде қолданамыз.',
        task: 'find әдісін аяқта. Мән бірнеше рет кездессе, алғашқы индексін қайтар. Бос массив үшін -1 қайтар.'
      }
    ]
  }
];

// Stable IDs retain existing local progress and drafts when content is expanded.
const detailedContent = { ...pythonContent, ...javaContent };
for (const course of courses) {
  for (const lesson of course.lessons) {
    Object.assign(lesson,detailedContent[lesson.id] || {});
    lesson.practice = (lesson.practice || []).map(exercise=>({
      ...exercise,title:exercise.title.replace(/^\d+\.\s*/,'')
    }));
  }
  const minutes = course.lessons.reduce((total,lesson)=>total+lesson.minutes,0);
  course.duration = Math.floor(minutes/60)+' сағ '+minutes%60+' мин';
  course.description = course.id === 'python'
    ? 'Python-ды түсініп үйрен: толық теория, қадамдап талданған мысалдар және шешімі бар жаттығулар.'
    : 'Java негіздерін меңгер: дерек типтерінен объектілер мен алгоритмдерге дейінгі толық түсіндірме.';
}

// Explicitly illustrative people. Never merge with a real server leaderboard.
export const demoLeaders = [
  { id: 'demo-1', rank: 1, name: 'Айша Нұр', username: 'aisha.codes', xp: 2450, streak: 12, avatar: 'АН', color: 'purple' },
  { id: 'demo-2', rank: 2, name: 'Әлихан', username: 'alikhan_dev', xp: 2180, streak: 9, avatar: 'Ә', color: 'blue' },
  { id: 'demo-3', rank: 3, name: 'Дана', username: 'dana.py', xp: 1940, streak: 7, avatar: 'Д', color: 'yellow' },
  { id: 'demo-4', rank: 4, name: 'Мирас', username: 'miras_java', xp: 1760, streak: 6, avatar: 'М', color: 'green' },
  { id: 'demo-5', rank: 5, name: 'Аружан', username: 'aru_code', xp: 1520, streak: 5, avatar: 'А', color: 'pink' }
];
