# EvoGym-inspired browser experiment

This is an unofficial, simplified educational adaptation, not the EvoGym engine or benchmark.

Source: https://github.com/EvolutionGym/evogym/tree/f63c649c688adda1accad5f86731aad96606388a
Upstream copyright: Copyright (c) 2022 jagdeepsb
License: MIT; complete text in [LICENSE-EvoGym.txt](LICENSE-EvoGym.txt).

`core.js`, function `control`: shared actuator-edge goal averaging is adapted from
`evogym/simulator/SimulatorCPP/PhysicsEngine.cpp`, `update_actuator_goals`.
Changes: rewritten in JavaScript using arrays of incident actuator indices; rest lengths
are supplied by a small neural network. The upstream integration, contact solver,
actuator dynamics, constants, Python wrappers and dependencies are not included.

The five voxel material categories follow EvoGym. The rest of this implementation
(spring/contact approximation, body construction, genetic search, UI and generated
example) was written for ALIFE Collection and is under the root software MIT license.
No upstream pretrained models, benchmark environments, images, Eigen, GLFW, GLEW,
PyTorch or third-party NEAT implementations are bundled. No endorsement is implied.

本ページは非公式の軽量実装です。公式の共有筋肉辺の平均化処理を翻案し、MIT表示を同梱しています。
公式エンジン・学習済みモデル・依存ライブラリは同梱していません。
