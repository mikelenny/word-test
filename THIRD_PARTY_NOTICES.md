# 第三方数据与许可证

“词听”的应用代码使用 MIT 许可证（见 [LICENSE](LICENSE)）。`data/` 下的词库、音标、释义和例句来自以下开源项目，按各自的许可证使用。

生成脚本对原始数据做了清洗、去重、截断和字段压缩；原始数据文件本身不随本仓库发布。

---

## 1. KyleBing/english-vocabulary

- 仓库：<https://github.com/KyleBing/english-vocabulary>
- 使用内容：高考（高中）、雅思、四级、考研词库的音标、释义与双语例句。
- 许可证：BSD 3-Clause

```text
BSD 3-Clause License

Copyright (c) 2022-2026, KyleBing

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

## 2. pluto0x0/word3500

- 仓库：<https://github.com/pluto0x0/word3500>
- 使用内容：高考英语 3500 词表（用于确定高考词库的收录范围与考纲释义）。
- 许可证：MIT

```text
MIT License

Copyright (c) 2019 pluto0x0

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 3. 其他说明

- 应用图标由本项目生成，随应用代码按 MIT 许可证发布。
- 发音使用设备系统自带的语音合成（`speechSynthesis`），项目不包含任何录音文件，也不调用在线语音服务。
- 例句、释义、音标等内容的著作权归原数据提供方及原作者；本项目仅做格式转换，供个人学习使用。如需商用或大规模再分发，请自行核实上游数据的授权范围。
- 如果你认为某段内容侵犯了你的权利，请提出 issue，我们会尽快处理。
