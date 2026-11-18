# 读心冠 BCI 测试协议

> 版本：v0.1（2026-11-17）
> 状态：草案，购买 Muse 2 前确定
> 目标：①验证技术可行性 ②验证"犹豫"判定的合理性 ③产出可展示的结果

## 1. 研究依据（Rationale）

### 1.1 为什么用 EEG 判断"犹豫"
- 游戏中的关键时刻是：**AI 推翻了玩家的答案，玩家要决定改不改**。这时玩家处在"自己的判断 vs AI 的说法"的冲突和不确定中
- 额叶中线 θ 波（4–8Hz）是认知神经科学里研究最充分的"冲突/不确定"指标之一：
  - 冲突、错误、惩罚、新异刺激都会引起额叶 θ 功率升高（Cavanagh & Frank, 2014）
  - θ 波反映在"行动结果不确定"时调整行为的过程（Cavanagh & Shackman, 2014 元分析）
  - 逐次试验的额叶 θ 与相对不确定性线性相关（Cavanagh et al., 2012）
- 决策信心可以从单次试验的 EEG 中解码：
  - Krumpe et al.（2019）：高/低信心的单试次分类准确率平均可达约 70%
  - 2023 年 J. Neural Eng. 研究：仅凭反应前的 EEG 就能可靠解码信心，并模拟了 BCI 应用
- 反应时也和决策信心强相关 → 作为行为指标，与 EEG 互相印证

### 1.2 设备策略
- **主设备：Muse 2**
  - 有学术验证（Krigolson et al., 2017，测出了 N200、P300、奖励正波）
  - 便宜、无线、干电极、能连浏览器——装置版和线上版都能用
  - 局限：没有 Fz 电极，只能用 AF7/AF8 近似额叶中线 θ
- **对比设备（如能借到）：带 Fz 的 EEG 系统**（如 g.tec Unicorn Hybrid Black：Fz、C3、Cz、C4、Pz、PO7、Oz、PO8）
  - 用来验证：Muse 2 测到的"犹豫"信号，和真正在 Fz 测到的结果是否一致

### 1.3 局限（展示时也要坦白说明）
- 额叶中线 θ 的最佳位置是 Fz，Muse 没有这个位置；只能用 AF7/AF8 近似
- AF7/AF8 很容易受眨眼、皱眉、肌肉动作干扰
- 已有研究发现 Muse 2 在某些场景下测不出认知负荷变化（Zhang & Cui, 2022）
- 学术研究里的解码准确率来自高密度 EEG 和大量试次，我们只有 4 通道和 8 道题
→ **所以必须用本测试验证，不能直接假设有效**

## 2. 判定方案（初版）

### 2.1 犹豫的操作定义
**犹豫指数** = 决策窗口内的额叶 θ 功率，相对于该玩家自己基线的升高程度（z 分数）

- **决策窗口**：AI 说完 → 玩家点击"改/不改"（主要窗口）
- 次要窗口：出题 → 初次作答（备用，测试后决定要不要用）
- **通道**：AF7、AF8 取平均；TP9/TP10 用来检查信号质量
- **频段**：θ 4–8Hz；备选指标：θ/α 比值
- **个人基线**：游戏开始前做校准（见 2.2）
- **伪迹处理**：振幅超过阈值（例如 ±100µV）的片段判定为眨眼或动作，予以剔除；剔除太多则该题标记为"读不出"

### 2.2 游戏开场校准（约 60–90 秒，可以包装成"读心冠加冕仪式"）
1. 睁眼静坐 30 秒 → 静息基线
2. 2–3 道练习题（非常简单）→ "无犹豫"基线
3. 校准时同步检查电极接触质量

### 2.3 在天平判定中的位置
| 因素 | 权重 | 玩家是否可见 |
|---|---|---|
| 答案是否正确 | 主要 | 可见 |
| 是否更改答案 | 主要 | 隐藏 |
| EEG 犹豫指数 | 中等 | 隐藏（最后由读心冠揭晓） |
| 作答时间 | 小 | 隐藏 |
具体权重在测试后决定。

### 2.4 退路
- 如果测试发现 EEG 区分不出犹豫：
  - 方案 A：判定主要靠作答时间，EEG 只作为"读心冠读数"展示，不参与计分
  - 方案 B：改用 Muse 能稳定测到的信号（如眨眼频率、专注/放松状态）
- 无论哪种，展示时都要如实说明 EEG 起了什么作用

## 3. 测试计划

### 阶段 0：技术连通（到货当天）
- [ ] 比较 web-muse 和 muse-jsx 哪个能在 Chrome 中稳定连接
- [ ] 能实时读取 4 通道原始 EEG（256Hz）
- [ ] 显示每个电极的接触质量
- [ ] 眨眼测试：眨眼时 AF7/AF8 出现明显尖峰 → 可视化（**可展示**）
- [ ] 游戏事件（出题、作答、AI 发言）能打上时间戳，与 EEG 对齐
- [ ] 连续记录 15 分钟不断线

### 阶段 1：信号真实性检验（第 1 天）
- 经典的"睁眼 vs 闭眼"测试：闭眼时 α 波（8–12Hz）明显升高，主要在 TP9/TP10
- 每人：睁眼 1 分钟 → 闭眼 1 分钟，重复 3 次
- 目的：证明设备测到的是真实脑电，而不是噪音（**可展示：频谱对比图**）

### 阶段 2：犹豫判定验证（主要实验）
- **被试**：5-8人（队员 + 朋友），不能是写题目的人
- **任务**：用游戏流程做约 40 道判断题
  - 难度混合：简单题 / 模糊题 / 常见误解题（如"金鱼只有三秒记忆"）
  - AI 有时同意、有时反驳玩家
- **每题结束后**：玩家自评刚才"改不改"时的确定程度（1 = 很犹豫，4 = 很确定）→ 作为"真实标签"
- **记录**：EEG 原始数据、事件时间戳、答案、是否更改、反应时、自评
- **分析**：
  1. 自评"犹豫"vs"确定"两类试次，比较决策窗口的 θ 指数（组内比较）
  2. θ 指数与自评、与反应时的相关性
  3. 简单分类器（逻辑回归）+ 留一交叉验证，报告准确率与随机水平（50%）的差距
- **成功标准（初定）**：多数被试的 θ 指数在"犹豫"试次中更高，且分类准确率明显高于随机水平

### 阶段 3：游戏内试玩
- 用正式的 8 道题和天平判定完整试玩，收集体验反馈 → 记录到 04_playtest/

### 阶段 4：设备对比（如能借到设备）
- **被试**：尽量用阶段 2 的同一批人
- **流程**：完全相同的游戏流程和自评方式
- **题目**：使用另一套难度相当的题（B 套），避免被试记住答案
- **不同时佩戴两台设备**：Muse 和 EEG 帽在额头、耳后位置可能冲突，信号也会互相干扰；分开测，两次间隔至少一天
- **对比**：
  1. Fz 的 θ 指数是否能区分"犹豫"和"确定"
  2. Muse AF7/AF8 的结果与 Fz 是否一致（方向一致、效果大小对比）
  3. 两台设备的分类准确率对比
- **结论用途**：如果 Muse 2 与 Fz 结果一致 → 展示时可以说 Muse 的判定有依据；如果不一致 → 作为局限如实说明，并写入 future work

## 4. 可展示的产出
| 产出 | 用途 |
|---|---|
| 实时 EEG 波形 + 眨眼尖峰演示 | 网站 / 视频，直观展示"读心冠在读你的脑" |
| 睁眼/闭眼 α 波对比图 | 证明设备有效 |
| 犹豫 vs 确定的 θ 指数对比图 | 证明判定逻辑有依据 |
| 分类准确率 + 局限说明 | 体现科学严谨，诚实说明边界 |
| 本文档的研究依据部分 | storyboard / 项目网站的 rationale 页面 |

## 5. 需要准备的东西（购买前确认）
- [ ] Muse 2
- [ ] 带蓝牙的笔记本电脑 + Chrome
- [ ] 备用：Mind Monitor 应用（手机录制 Muse 数据，网页连接出问题时用）
- [ ] 酒精棉片 / 湿巾（清洁电极、改善接触）
- [ ] 安静、光线稳定的房间
- [ ] 40 道测试题 + 自评问卷（另外整理）
- [ ] 简单的知情同意说明（数据匿名、不做医疗用途）
- [ ] 数据分析环境（Python：MNE 或 numpy/scipy）

## 6. 数据管理
- 每次测试建一个文件夹：`02_bci/tests/日期_测试名/`
  - raw-data/（原始 EEG + 事件 CSV）
  - notes.md（被试编号、环境、意外情况）
  - results.md（结果和图）
- 被试只用编号（P01, P02...），不记录姓名


## 参考文献
- Cavanagh, J. F., & Frank, M. J. (2014). Frontal theta as a mechanism for cognitive control. *Trends in Cognitive Sciences*. https://pmc.ncbi.nlm.nih.gov/articles/PMC4112145
- Cavanagh, J. F., & Shackman, A. J. (2014). Frontal midline theta reflects anxiety and cognitive control: Meta-analytic evidence. *Journal of Physiology-Paris*. https://pmc.ncbi.nlm.nih.gov/articles/PMC4213310
- Cavanagh, J. F., Figueroa, C. M., Cohen, M. X., & Frank, M. J. (2012). Frontal theta reflects uncertainty and unexpectedness during exploration and exploitation. *Cerebral Cortex*. https://pmc.ncbi.nlm.nih.gov/articles/PMC4296208
- Krigolson, O. E., et al. (2017). Choosing MUSE: Validation of a low-cost, portable EEG system for ERP research. *Frontiers in Neuroscience*, 11, 109. https://doi.org/10.3389/fnins.2017.00109
- Krumpe, T., Gerjets, P., Rosenstiel, W., & Spüler, M. (2019). Decision confidence: EEG correlates of confidence in different phases of an old/new recognition task. *Brain-Computer Interfaces*. https://www.biorxiv.org/content/10.1101/479204.full.pdf
- Post-stimulus encoding of decision confidence in EEG: toward a brain–computer interface for decision making (2023). *Journal of Neural Engineering*. https://dx.doi.org/10.1088/1741-2552/acec14
- Zhang, L., & Cui, H. (2022). Reliability of MUSE 2 and Tobii Pro Nano at capturing mobile application users' real-time cognitive workload changes. *Frontiers in Neuroscience*. https://doi.org/10.3389/fnins.2022.1011475
- Decoding Chess Puzzle Play and Standard Cognitive Tasks for BCI: A Low-Cost EEG Study（Muse 2，AF7/AF8）