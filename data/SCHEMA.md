# 数据结构规范（v1）

所有数据文件均为 UTF-8 JSON，位于 `data/`。  
`tools/build.mjs` 会读取下列文件并打包为 `app/data.bundle.js`，**页面只认打包产物**。

```
data/meta.json              应用元信息
data/chapters.json          章节枚举
data/sources.json           原始资料索引
data/plan.json              30 天计划
data/formulas.json          公式 / 结论速查
data/chem_equations.json    化学方程式速查
data/vocab.json             英语单词
data/methods.json           方法卡
data/kp/*.json              知识卡
data/questions/*.json       题库
```

---

## 1. 学科与章节

### 1.1 学科（`subject`）

| id | 名称 |
|---|---|
| `math` | 数学 |
| `physics` | 物理 |
| `chemistry` | 化学 |
| `english` | 英语 |

学科颜色、名称、描述在 `meta.json` 的 `subjects` 中。

### 1.2 章节（`chapter`）

章节 id **固定**，不得自造。当前 23 个：

| 学科 | 章节 id | 名称 |
|---|---|---|
| 数学 | `M01` | 集合与常用逻辑用语 |
| 数学 | `M02` | 等式与不等式 |
| 数学 | `M03` | 函数 |
| 数学 | `M04` | 导数及其应用 |
| 数学 | `M05` | 三角函数与解三角形 |
| 数学 | `M06` | 数列 |
| 数学 | `M07` | 立体几何 |
| 数学 | `M08` | 平面解析几何 |
| 数学 | `M09` | 计数原理与概率统计 |
| 数学 | `M10` | 复数与平面向量 |
| 物理 | `P01` | 运动的描述 |
| 物理 | `P02` | 运动学实验与模型 |
| 化学 | `C01` | 金属及其化合物 |
| 化学 | `C02` | 非金属及其化合物 |
| 化学 | `C03` | 物质结构与元素周期律 |
| 化学 | `C04` | 化学反应与能量 |
| 化学 | `C05` | 有机化学基础 |
| 化学 | `C06` | 化学实验与计算 |
| 英语 | `E01` | 词性与短语基础（Day1–6） |
| 英语 | `E02` | 经济·健康·科技（Day7–12） |
| 英语 | `E03` | 人文·旅行·科学（Day13–18） |
| 英语 | `E04` | 媒体·职业·社会（Day19–24） |
| 英语 | `E05` | 综合冲刺（Day25–30） |

> 新增章节：先改 `chapters.json`，再在 `app.js` 中确认逻辑不依赖写死的章节数组（当前按数据驱动）。

---

## 2. 知识卡 `data/kp/*.json`

```json
{
  "block": "M03",
  "items": [
    {
      "id": "M03-01",
      "subject": "math",
      "chapter": "M03",
      "topic": "函数的概念与三要素",
      "core": "函数是两个非空数集之间的对应关系……",
      "detail": "函数的三要素是定义域、对应关系、值域……",
      "formulas": ["y = f(x)，x ∈ A", "定义域：x 的取值范围"],
      "bullets": ["定义域优先原则", "同一函数：定义域 + 对应关系相同"],
      "examples": [
        { "q": "f(x) = x 与 g(x) = x^2/x 是同一函数吗？", "a": "不是。g(x) 的定义域为 x ≠ 0。" }
      ],
      "mnemonic": "定义域优先",
      "trap": "易错：化简后相同就判定为同一函数，忽略定义域。",
      "source": { "file": "高中数学核心知识背记手册（背记版）.pdf", "page": 22 },
      "star": 4,
      "tags": ["概念", "定义域"]
    }
  ]
}
```

| 字段 | 必填 | 类型 | 说明 |
|---|:---:|---|---|
| `id` | ✔ | string | 全局唯一，建议 `章节-两位序号` |
| `subject` | ✔ | string | `math` / `physics` / `chemistry` / `english` |
| `chapter` | ✔ | string | 上表 23 个之一，且学科必须一致 |
| `topic` | ✔ | string | 8–20 字 |
| `core` | ✔ | string | 一句话核心结论，能独立成卡 |
| `detail` | ✘ | string | 展开说明，100–350 字 |
| `formulas` | ✘ | string[] | 公式/关键表达，每行一条 |
| `bullets` | ✘ | string[] | 2–7 条要点 |
| `examples` | ✘ | object[] | `{q, a}`，可多道 |
| `mnemonic` | ✘ | string | 口诀，≤ 20 字 |
| `trap` | ✘ | string | 易错点，建议以「易错：」开头 |
| `source` | ✔ | object | `{file, page}`，file 必须在 `sources.json` 中 |
| `star` | ✔ | number | 1–5 |
| `tags` | ✘ | string[] | 标签 |

### 行内公式写法

正文（`core` / `detail` / `bullets` / `examples` / `trap`）支持：

- `$...$` 包裹的公式，例如 `若 $a>0$，则……`；
- 不在 `$` 里的 `x^2`、`a_n`、`frac{a}{b}`、`sqrt{x}`、`H_2O` 也会被自动识别；
- 连续下划线 `____` 会被识别为填空空位，不会当成下标。

公式表达式（`formulas` 数组、`expr`、`equation`）直接用轻量标记：

| 写法 | 效果 |
|---|---|
| `frac{a+b}{2}` | 分数 |
| `sqrt{b^2-4ac}` | 根号 |
| `abs{x}` | 绝对值 |
| `vec{a}` / `overrightarrow{AB}` | 向量 |
| `x^2`、`a_n`、`H_2SO_4` | 上下标 |
| `--点燃-->` | 反应箭头上方写条件 |
| `→` `⇌` `↑` `↓` | 直接写 Unicode |

---

## 3. 题目 `data/questions/*.json`

```json
{
  "block": "MATH_GEN",
  "items": [
    {
      "id": "Q-MG-0001",
      "subject": "math",
      "chapter": "M06",
      "type": "single",
      "stem": "等差数列 {a_n} 中，a_1=-3，d=2，则 a_6=（　）",
      "options": ["6", "7", "21", "4"],
      "answer": [1],
      "explain": "a_n=a_1+(n-1)d=-3+5×2=7。",
      "source": { "file": "高中数学核心知识背记手册（背记版）.pdf", "page": 42 },
      "kp": ["M06-02"],
      "difficulty": 2,
      "tags": ["计算"]
    }
  ]
}
```

| 字段 | 必填 | 说明 |
|---|:---:|---|
| `id` | ✔ | 全局唯一 |
| `subject` / `chapter` | ✔ | 同上，必须匹配 |
| `type` | ✔ | `single` / `multi` / `judge` / `fill` |
| `stem` | ✔ | 题干；填空用连续下划线表示空位 |
| `options` | 除 fill 外 ✔ | 选项文本，不带 A/B/C/D 前缀；judge 固定 `["正确","错误"]` |
| `answer` | 除 fill 外 ✔ | 选项下标数组；single/judge 长度 1，multi ≥ 2 |
| `answerText` | fill ✔ | 可接受答案数组，如 `["discovery"]` |
| `explain` | ✔ | 解析，先结论后依据 |
| `source` | ✘ | 来源文件 + 页码 |
| `kp` | ✘ | 关联知识卡 id |
| `difficulty` | ✘ | 1 易 / 2 中 / 3 难 |
| `tags` | ✘ | 标签 |

### 命题红线（`validate.mjs` 会检查）

1. 单选必须 4 个选项，答案唯一；
2. 多选至少 2 个正确项；
3. 判断题的错误项应是「改一个关键词/数字」式硬错；
4. 填空答案必须能在资料中找到依据；
5. 题干不要写「下列说法正确的是」这类无信息量套话（概念辨析题除外）；
6. 解析不得为空，不得只写「见教材」。

---

## 4. 公式 `data/formulas.json`

```json
{
  "items": [
    {
      "id": "F-M-004",
      "subject": "math",
      "chapter": "M02",
      "name": "基本不等式",
      "expr": "a + b ≥ 2sqrt{ab}（a>0，b>0）",
      "note": "当且仅当 a=b 时取等",
      "tags": ["不等式", "必背"]
    }
  ]
}
```

## 5. 化学方程式 `data/chem_equations.json`

```json
{
  "items": [
    {
      "id": "E-Na-04",
      "chapter": "C01",
      "section": "钠",
      "name": "钠与水",
      "equation": "2Na + 2H_2O = 2NaOH + H_2↑",
      "note": "浮、熔、游、响、红",
      "page": 1
    }
  ]
}
```

- `section` 用于速查页分组（钠、氧化钠、过氧化钠……）；
- `equation` 必须配平；
- 条件用 `--条件-->`，可逆反应用 `⇌`。

## 6. 单词 `data/vocab.json`

```json
{
  "items": [
    {
      "id": "V-0001",
      "word": "achieve",
      "related": "achievement",
      "cn": "动词，实现",
      "pos": "动词",
      "example": "He hopes to achieve his goal this year.",
      "day": 1,
      "theme": "基础动词与名词转换",
      "explain": "……",
      "chapter": "E01"
    }
  ]
}
```

- 按资料原 30 天分组（`day` 1–30）；
- `pos` 用于卡片上的小标签；
- `related` 是相关词形，不一定是词根。

## 7. 方法卡 `data/methods.json`

```json
{
  "items": [
    {
      "id": "MM-01",
      "subject": "math",
      "chapter": "M02",
      "title": "直接法",
      "when": "什么时候用……",
      "steps": ["步骤 1", "步骤 2"],
      "example": "x > 0 时，x + 4/x ≥ 4。",
      "trap": "等号取不到时不能直接写最小值。",
      "source": { "file": "基本不等式求最值的12种方法汇总.pdf", "page": 2 }
    }
  ]
}
```

## 8. 计划 `data/plan.json`

```json
{
  "items": [
    {
      "day": 1,
      "title": "先搭骨架：集合与逻辑",
      "focus": ["M01"],
      "cards": 12,
      "quiz": 10,
      "words": 10,
      "minutes": 45,
      "note": "……"
    }
  ]
}
```

固定 30 天。`focus` 为章节 id 数组，用于计划页的跳转 chip。

## 9. 元信息 `data/meta.json`

| 字段 | 说明 |
|---|---|
| `name` / `shortName` / `tagline` | 应用名与标语 |
| `version` | 版本号 |
| `examDate` | 高考日期（默认 2027-06-07），可在设置里覆盖 |
| `examLabel` | 倒计时文案 |
| `dailyGoal` | `{cards, quiz, words, minutes}` 默认每日目标 |
| `passScore` | 模拟考达标线（当前逻辑固定 60） |
| `subjects` | 学科数组：`id/name/short/color/soft/desc` |

---

## 10. 构建与质检

```bash
node tools/build.mjs        # 数据 → app/data.bundle.js，并做结构校验
node tools/validate.mjs     # 覆盖率 / 题型 / 答案分布 / 重复题干 / 选项质量
node tools/build-mobile.mjs # 生成 dist/ 与单文件版
```

`build.mjs` 会检查：

- id 全局唯一；
- `subject` 合法，`chapter` 存在且学科一致；
- 题目 `answer` 下标不越界，单选/多选答案数量正确；
- 填空必须有 `answerText`；
- 来源文件在 `sources.json` 中；
- 选项是否有「以上都对」、重复项。

有错误时构建产物仍会生成，但进程退出码非 0，**上线前必须修到 0 错误**。
