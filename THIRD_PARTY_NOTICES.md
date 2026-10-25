# Third-party notices

Recovered browser code contains third-party implementations. Exact installed versions and the original lockfile were not recovered. The package versions below were downloaded separately **only to retrieve upstream notices and compare recognizable code**, not to claim the original dependency versions or rebuild the bundle.

| Component | Evidence and upstream | Notice obtained from |
| --- | --- | --- |
| qrcode / node-qrcode | Symbol/codeword table and utility error strings in the QR bundle match [soldair/node-qrcode](https://github.com/soldair/node-qrcode) | npm `qrcode@1.5.4`, [MIT notice](third-party-licenses/qrcode-LICENSE.txt) |
| jsQR | Embedded UMD `jsQR` export and QR decoder implementation; [cozmo/jsQR](https://github.com/cozmo/jsQR) | npm `jsqr@1.4.0`, [Apache-2.0 license](third-party-licenses/jsqr-LICENSE.txt) |
| dijkstrajs | Path-finding routines used by the QR encoder, including shortest-path predecessor handling; [andrewhayward/dijkstra](https://github.com/andrewhayward/dijkstra) | npm `dijkstrajs@1.0.3`, [upstream license notice](third-party-licenses/dijkstrajs-LICENSE.txt) |
| @dqcai/vn-lunar table | Wrapper explicitly attributes version 1.0.1 and author Đoàn Quốc Cường; [original constants](https://github.com/cuongdqpayment/dqcai-vn-lunar/blob/main/src/constants.ts) | [MIT notice retained in deployed code](third-party-licenses/vn-lunar-MIT.txt) |

The decoded copies and enclosing wrapper contain the same third-party implementations. Extraction does not restore upstream source file boundaries. No new blanket first-party license is granted by this recovery export. Public author attribution in license notices is intentionally preserved.

Playwright is a new development-only dependency for browser layout regression checks. It is not bundled into the application; the new lockfile records test tooling and does not identify the original deployed dependencies.
