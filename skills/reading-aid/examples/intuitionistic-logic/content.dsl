# Reading-aid source: Philip Wadler, "Propositions as Types" (CACM 2015), §4 Intuitionistic Logic.
# Inline term references: {{term-id|display text}} (display defaults to the term's "word").

title: 直觉主义逻辑 · 阅读辅助
source: 出处：Philip Wadler, “Propositions as Types”（命题即类型），Communications of the ACM, 2015，第 4 节 Intuitionistic Logic。
summary: 一句话大意：本节用一部喜歌剧的段子说明——直觉主义逻辑要求“证明 A 或 B 就必须指明是哪一个”，因此拒绝排中律；它与经典逻辑只差这一条（两者可互相翻译）；而“命题即类型”与直觉主义逻辑天然契合。

para: In {{gilbert-sullivan|Gilbert and Sullivan}}’s {{gondoliers-opera|The Gondoliers}}, Casilda is told that as an {{infant}} she was married to the {{heir}} of the King of {{batavia|Batavia}}, but that due to a {{mix-up}} no one knows which of two individuals, Marco or Giuseppe, is the heir. {{alarmed|Alarmed}}, she {{wail|wails}} “Then do you mean to say that I am married to one of two {{gondolier|gondoliers}}, but it is impossible to say which?” To which the response is “{{no-doubt|Without any doubt of any kind whatever.}}”
trans: 在吉尔伯特与沙利文的歌剧《贡多拉船夫》中，卡西尔达被告知：她在襁褓中就被许配给了巴达维亚国王的继承人；但由于一次差错，没人知道马可和朱塞佩这两个人中到底哪一位才是继承人。她惊慌失措地哀叹：“你是说，我嫁给了两个贡多拉船夫之一，却不可能说清是哪一个？”而得到的回答是：“毫无疑问，千真万确。”

para: Logic comes in many varieties, and one distinction is between {{classical}} and {{intuitionistic}}. {{intuitionists|Intuitionists}}, concerned by {{cavalier}} assumptions made by some logicians about the nature of {{infinity}}, {{insist|insist upon}} a {{constructionist}} notion of truth. In particular, they insist that a {{proof}} of A ∨ B must show which of A or B {{holds}}, and hence they would {{reject}} the claim that Casilda is married to Marco or Giuseppe until one of the two was identified as her husband. Perhaps Gilbert and Sullivan {{anticipated}} intuitionism, for their story’s {{outcome}} is that the heir turns out to be a third individual, Luiz, with whom Casilda is, {{conveniently}}, already in love.
trans: 逻辑有许多种类，其中一处分野在于经典逻辑与直觉主义逻辑之别。直觉主义者对某些逻辑学家就“无穷”之性质所做的不假思索的假设深感不安，因而坚持一种构造主义的真理观。特别地，他们坚持：对 A∨B 的证明必须指明 A 与 B 中哪一个成立；因此，在指认出两人中谁是丈夫之前，他们会拒绝“卡西尔达嫁给了马可或朱塞佩”这一断言。也许吉尔伯特与沙利文早已预见直觉主义——因为他们故事的结局是：真正的继承人原来是第三个人，路易兹；而卡西尔达恰好早已与他相爱。

para: Intuitionists also reject the {{excluded-middle|law of the excluded middle}}, which {{asserts}} A ∨ ¬A for every A, since the law gives no {{clue}} as to which of A or ¬A holds. {{heyting|Heyting}} {{formalised}} a {{variant}} of {{hilbert|Hilbert}}’s classical logic that {{captures}} the intuitionistic notion of {{provability}}. In particular, the law of the excluded middle is {{provable}} in Hilbert’s logic, but not in Heyting’s. Further, if the law of the excluded middle is added as an {{axiom}} to Heyting’s logic, then it becomes {{equivalent}} to Hilbert’s. {{kolmogorov|Kolmogorov}} showed the two logics were closely related: he gave a {{double-negation|double-negation translation}}, such that a {{formula}} is provable in classical logic {{iff|if and only if}} its translation is provable in intuitionistic logic.
trans: 直觉主义者还拒绝排中律——该定律断言对每个 A 都有 A∨¬A——因为它完全没有给出线索，说明 A 与 ¬A 中哪一个成立。海廷将希尔伯特经典逻辑的一个变体形式化，刻画了直觉主义的可证明性概念。特别地，排中律在希尔伯特逻辑中可证，但在海廷逻辑中不可证。此外，如果把排中律作为公理加入海廷逻辑，它就变得与希尔伯特逻辑等价。柯尔莫哥洛夫证明这两种逻辑密切相关：他给出了一种双重否定翻译，使得一个公式在经典逻辑中可证，当且仅当它的翻译在直觉主义逻辑中可证。

para: {{pat|Propositions as Types}} was first formulated for intuitionistic logic. It is a {{perfect-fit|perfect fit}}, because in the intuitionist {{interpretation}} the formula A ∨ B is provable exactly when one {{exhibits}} either a proof of A or a proof of B, so the type corresponding to {{disjunction}} is a {{disjoint-sum|disjoint sum}}.
trans: “命题即类型”最早是为直觉主义逻辑而阐述的。这是一个完美的契合：在直觉主义的解释下，公式 A∨B 恰恰在有人拿出 A 的证明或 B 的证明之一时才可证，因此与析取相对应的类型就是不相交和。

story-head: 这段文字出自哪里
story-para: 这是计算机科学家 Philip Wadler（爱丁堡大学，Haskell 语言的设计者之一）2015 年的著名文章《Propositions as Types》（命题即类型）的第 4 节。全文讲的是逻辑学与编程语言之间深刻的对应：命题即类型、证明即程序。这一节用一部喜歌剧的段子，引入“直觉主义逻辑”的动机。

story-head: 《贡多拉船夫》讲了什么
story-para: 《贡多拉船夫》（The Gondoliers; or, The King of Barataria）是吉尔伯特与沙利文 1889 年首演的两幕喜歌剧，故事发生在威尼斯。文中把剧中的 Barataria 记作 Batavia（巴达维亚历史上是荷兰人对雅加达的旧称，作者应是化用了这个名字）。
story-para: 剧情主线：多年前，国王的幼儿（王位继承人）因国内动乱被秘密送到威尼斯，交给一位老贡多拉船夫抚养。这位老船夫好酒贪杯，弄不清哪个是王室的孩子，于是把两个婴儿一并养大——从此再无人知道真正的继承人是谁。如今，候选的马可（Marco）与朱塞佩（Giuseppe）都成了威尼斯快活的贡多拉船夫，还各自娶了妻。与此同时，西班牙贵族小姐卡西尔达（Casilda）尚在襁褓中时，就被父亲做主许配给了“国王的继承人”；如今国王去世，她随父亲来到威尼斯认领丈夫——可谁也说不清她的丈夫到底是马可还是朱塞佩，而她真正爱的是随行侍从路易兹（Luiz）。
story-para: 本段开头引用的对话，正是卡西尔达得知真相那一刻的哀叹：“你是说，我嫁给了两个贡多拉船夫之一，却不可能说清是哪一个？”——得到的回答一本正经：“毫无疑问，千真万确。”（Without any doubt of any kind whatever.）
story-para: 结局（也是 Wadler 的笑点）：最后老船夫妻子伊内兹（Inez）出面作证，真相大白——真正的继承人既不是马可也不是朱塞佩，而是第三个人路易兹。卡西尔达恰好已经与他相爱，有情人终成眷属。
story-para: Wadler 借这个段子说明直觉主义的核心态度：只说“卡西尔达嫁给了马可或朱塞佩”、却不指认是哪一个，直觉主义者就不承认这是对“A∨B”的证明。他还打趣道：歌剧的结局（凭空冒出第三个人，把“或”直接消解掉）仿佛提前“预见”了直觉主义。
story-li: Casilda 卡西尔达——西班牙贵族之女，女主角
story-li: Marco 马可、Giuseppe 朱塞佩——两位贡多拉船夫，“继承人”候选人
story-li: Luiz 路易兹——卡西尔达父亲身边的侍从，卡西尔达的真爱（真继承人）
story-li: The Gondoliers《贡多拉船夫》——1889 年首演的喜歌剧

story-head: 吉尔伯特与沙利文是谁
story-para: W. S. Gilbert（剧作家、词作者，1836–1911）与 Arthur Sullivan（作曲家，1842–1900）是维多利亚时代英国最成功的轻歌剧搭档，1871–1896 年间合作了约十四部作品，如《H.M.S. 平纳福号》《彭赞斯的海盗》《日本天皇》（The Mikado）。他们的作品以“一本正经地讲荒唐事”著称——本段那句三重强调的官腔回答“Without any doubt of any kind whatever”就是典型的 Gilbert 式幽默。两人的歌剧在英语世界家喻户晓，常被当作文化典故引用，Wadler 用它来开场正是此故。

story-head: 什么是直觉主义
story-para: 直觉主义（intuitionism）由荷兰数学家 L. E. J. 布劳威尔（L. E. J. Brouwer, 1881–1966）于 1908 年前后创立。核心主张：数学不是先于人类而存在的符号游戏，而源于人心中的构造（construction）；一个命题为“真”，意味着我们能给出它的构造性证明；说“存在某个 x”，意味着我们能实际把 x 造出来。
story-para: 直觉主义者特别反对经典数学对“无穷”的处理方式：把无穷集合当作已经完成的现成整体、随意使用排中律与反证法——这正是文中 cavalier assumptions（想当然的假设）所指。布劳威尔与希尔伯特之间因此爆发了数学基础史上著名的激烈论战（Grundlagenstreit）。希尔伯特的著名回应是：“没有人能把我们从康托尔为我们创造的乐园中驱逐出去。”

story-head: 排中律之争：一个例子
story-para: 排中律（law of excluded middle）：对任何命题 A，A∨¬A——要么 A 成立，要么 A 不成立，没有第三种可能。经典逻辑把它视为不容置疑的基本原则。
story-para: 直觉主义者为什么拒绝？举例：设 A = “π 的十进制展开中出现连续一百个 7”。经典逻辑立刻断言 A∨¬A。但直觉主义者指出：目前既没有人证明 A，也没有人证明 ¬A；在构造出任何一边的证明之前，“总有一个对”只是空话——正如说“卡西尔达嫁给了马可或朱塞佩”却不指认是哪一个。尤其当命题涉及无穷（如 π 的无穷多位小数）时，我们没有任何根据保证一定能找到答案。

story-head: 三位逻辑学家：希尔伯特、海廷、柯尔莫哥洛夫
story-li: 大卫·希尔伯特（David Hilbert, 1862–1943，德国）：形式主义学派领袖，提出把全部数学形式化的“希尔伯特计划”。他发展的经典逻辑系统（后经其学生 Bernays 完善）即文中“希尔伯特的逻辑”，排中律在其中可证。
story-li: 阿伦德·海廷（Arend Heyting, 1898–1980，荷兰）：布劳威尔学派成员。有趣的是，布劳威尔本人反对把直觉主义逻辑形式化，认为那是“没有灵魂的躯壳”；海廷却于 1930 年给出了直觉主义逻辑的第一个完整形式系统（即今天所称的 Heyting 逻辑），恰好“刻画”（captures）了直觉主义的可证明性概念。排中律在其中不可证；把排中律加为公理后，该系统与希尔伯特经典逻辑等价——说明排中律正是两种逻辑之间的全部差别。
story-li: 安德雷·柯尔莫哥洛夫（Andrey Kolmogorov, 1903–1987，苏联）：二十世纪最伟大的概率论学家之一。1925 年（22 岁）发表论文给出双重否定翻译；1932 年又提出直觉主义逻辑的“问题解释”：公式＝问题，证明＝解法。这与海廷的证明解释合称 BHK 解释（Brouwer–Heyting–Kolmogorov）。

story-head: 双重否定翻译是什么
story-para: 想法：在公式的适当位置都插上双重否定 ¬¬，得到翻译式 A*。定理：A 在经典逻辑中可证，当且仅当 A* 在直觉主义逻辑中可证。直觉上的意义：直觉主义逻辑承认的证明更少（“更强”的立场），但它并没有丢掉经典数学——经典定理都可以翻译后保留下来。这就是文中说两种逻辑“密切相关”的含义。这一技术后来成为证明论的基本工具，它与程序设计中的续体变换（CPS）深刻对应——那正是 Wadler 本人的著名研究工作之一。

story-head: 为什么“命题即类型”与直觉主义是完美契合
story-para: Propositions as Types（命题即类型，又称 Curry–Howard 对应）说：命题＝类型，证明＝程序（项）。A→B（蕴含）对应函数类型：给一个 A 的证明，就能造出 B 的证明；A∧B（且）对应积类型（二元组）；A∨B（或）对应和类型，即 disjoint sum（不相交和）：值要么是“左边那个 A”，要么是“右边那个 B”，并且必须带标签。
story-para: 直觉主义要求“证明 A∨B 必须指明是哪一边”——这恰好就是带标签联合（tagged union）在编程中的行为：你不可能凭空造出一个“不知道是哪个”的值。既然直觉主义逻辑的证明本来就必须是“可执行的构造”，它天然就是编程语言的类型系统——所以这门对应最早为直觉主义逻辑而阐述，而且是 perfect fit（完美契合）。
