# 词库数据说明

`data/` 目录下的 JSON 文件是“词听”运行时使用的压缩词库，由 `tools/build_data.py` 从以下开源数据生成：

| 来源 | 许可证 | 用途 |
| --- | --- | --- |
| [KyleBing/english-vocabulary](https://github.com/KyleBing/english-vocabulary) | BSD-3-Clause | 高考、雅思、四级、考研词库的音标、释义、双语例句 |
| [pluto0x0/word3500](https://github.com/pluto0x0/word3500) | MIT | 高考 3500 词表与考纲释义 |

完整的许可证文本见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 数据处理

- 只保留单词、音标、精简释义、双语例句等必要字段，以减小离线包体积。
- 合并同一词库内的重复词条；高考词库以 3500 词表为范围，其他词库保留上游顺序。
- 释义最多保留 4 个义项并截断过长文本；每词优先挑选长度适中、带标点、带中文翻译的例句。
- 对常见功能词补充了简明音标和释义，保证查词和选择题选项完整。
- 生成后的词库共 18,594 条词条、8,513 个词典词条，约 3.5 MB。

## 使用范围

词库仅供个人学习、教学和离线使用。释义、音标、例句的版权归原数据提供方及原作者所有；本项目不对内容的准确性作担保。如需商业使用或再分发，请先核对上游项目的许可证与内容来源。

如需重新生成，请运行：

```bash
python3 tools/fetch_sources.py
python3 tools/build_data.py --src data-src --out data
```
