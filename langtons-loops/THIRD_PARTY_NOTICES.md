# Langton's Loops — sources and attribution

Original model: Christopher G. Langton, "Self-reproduction in cellular automata", Physica D 10 (1984), 135–144.
https://doi.org/10.1016/0167-2789(84)90256-2

The 219 transition entries and 86-cell seed in rules.js were adapted from CellPyLib by Luis M. Antunes, under Apache License 2.0 (included in LICENSE-CellPyLib.txt).
Source revision: 743e936d48f8520f6f4ac652570ac7bb46414189
https://github.com/lantunes/cellpylib/blob/743e936d48f8520f6f4ac652570ac7bb46414189/cellpylib/langtons_loop.py
Changes: extracted the numerical table and starting arrangement into JavaScript string arrays. No Python runtime or CellPyLib simulation engine is shipped.

The transition entries were cross-checked against Golly's Rule Table Repository:
https://github.com/GollyGang/ruletablerepository/blob/gh-pages/downloads/Langtons-Loops.table
That table credits Eli Bachmutsky's Self-Replicating Loops & Ant (1999) as its source.

The browser engine, interaction code and bilingual guide were implemented for ALIFE Collection. The finite empty border and fallback to state 0 for unlisted neighborhoods are documented on the guide page. The original authors do not endorse this site.
