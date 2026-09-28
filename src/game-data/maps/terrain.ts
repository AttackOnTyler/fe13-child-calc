/**
 * Awakening's terrain types, their Def/Avo/Heal, and movement cost per movement row, from the game's own GameData
 * (extracted by scripts/play/maps/extract.ts on play/azahar-harness). Don't hand-edit: re-extract.
 * A map grid's char is a terrain type's `char`; a class's movement row is CLASS_MOVE_ROW; null cost = impassable.
 */
export const TERRAIN = [
 {
  "index": 0,
  "char": "0",
  "key": "TID_移動不可",
  "name": "Obstacle",
  "category": 0
 },
 {
  "index": 1,
  "char": "1",
  "key": "TID_平地",
  "name": "Plain",
  "category": 1
 },
 {
  "index": 2,
  "char": "2",
  "key": "TID_荒野",
  "name": "Waste",
  "category": 1
 },
 {
  "index": 3,
  "char": "3",
  "key": "TID_林",
  "name": "Woods",
  "category": 2
 },
 {
  "index": 4,
  "char": "4",
  "key": "TID_砂漠",
  "name": "Desert",
  "category": 3
 },
 {
  "index": 5,
  "char": "5",
  "key": "TID_砂浜",
  "name": "Beach",
  "category": 3
 },
 {
  "index": 6,
  "char": "6",
  "key": "TID_山",
  "name": "Mountain",
  "category": 4
 },
 {
  "index": 7,
  "char": "7",
  "key": "TID_高山",
  "name": "Peak",
  "category": 6
 },
 {
  "index": 8,
  "char": "8",
  "key": "TID_崖",
  "name": "Cliff",
  "category": 6
 },
 {
  "index": 9,
  "char": "9",
  "key": "TID_崖（影無）",
  "name": "Cliff",
  "category": 6
 },
 {
  "index": 10,
  "char": "a",
  "key": "TID_空",
  "name": "Sky",
  "category": 6
 },
 {
  "index": 11,
  "char": "b",
  "key": "TID_骨",
  "name": "Bones",
  "category": 6
 },
 {
  "index": 12,
  "char": "c",
  "key": "TID_船",
  "name": "Ship",
  "category": 6
 },
 {
  "index": 13,
  "char": "d",
  "key": "TID_帆",
  "name": "Mast",
  "category": 0
 },
 {
  "index": 14,
  "char": "e",
  "key": "TID_橋（屋外）",
  "name": "Bridge",
  "category": 1
 },
 {
  "index": 15,
  "char": "f",
  "key": "TID_橋（屋内）",
  "name": "Bridge",
  "category": 11
 },
 {
  "index": 16,
  "char": "g",
  "key": "TID_河",
  "name": "Water",
  "category": 5
 },
 {
  "index": 17,
  "char": "h",
  "key": "TID_海",
  "name": "Sea",
  "category": 6
 },
 {
  "index": 18,
  "char": "i",
  "key": "TID_湖",
  "name": "Lake",
  "category": 6
 },
 {
  "index": 19,
  "char": "j",
  "key": "TID_砦",
  "name": "Fort",
  "category": 7
 },
 {
  "index": 20,
  "char": "k",
  "key": "TID_城門",
  "name": "Gate",
  "category": 8
 },
 {
  "index": 21,
  "char": "l",
  "key": "TID_城",
  "name": "Castle",
  "category": 0
 },
 {
  "index": 22,
  "char": "m",
  "key": "TID_村",
  "name": "Village",
  "category": 9
 },
 {
  "index": 23,
  "char": "n",
  "key": "TID_閉じ村",
  "name": "(Village)",
  "category": 9
 },
 {
  "index": 24,
  "char": "o",
  "key": "TID_廃村",
  "name": "(Village)",
  "category": 10
 },
 {
  "index": 25,
  "char": "p",
  "key": "TID_家",
  "name": "House",
  "category": 9
 },
 {
  "index": 26,
  "char": "q",
  "key": "TID_閉じ家",
  "name": "(House)",
  "category": 9
 },
 {
  "index": 27,
  "char": "r",
  "key": "TID_廃家",
  "name": "(House)",
  "category": 10
 },
 {
  "index": 28,
  "char": "s",
  "key": "TID_低建物",
  "name": "Building",
  "category": 6
 },
 {
  "index": 29,
  "char": "t",
  "key": "TID_建物",
  "name": "Edifice",
  "category": 0
 },
 {
  "index": 30,
  "char": "u",
  "key": "TID_祭壇",
  "name": "Altar",
  "category": 0
 },
 {
  "index": 31,
  "char": "v",
  "key": "TID_瓦礫",
  "name": "Rubble",
  "category": 6
 },
 {
  "index": 32,
  "char": "w",
  "key": "TID_柵",
  "name": "Fence",
  "category": 6
 },
 {
  "index": 33,
  "char": "x",
  "key": "TID_床",
  "name": "Floor",
  "category": 11
 },
 {
  "index": 34,
  "char": "y",
  "key": "TID_階段",
  "name": "Stairs",
  "category": 12
 },
 {
  "index": 35,
  "char": "z",
  "key": "TID_柱",
  "name": "Pillar",
  "category": 13
 },
 {
  "index": 36,
  "char": "A",
  "key": "TID_玉座",
  "name": "Throne",
  "category": 14
 },
 {
  "index": 37,
  "char": "B",
  "key": "TID_低壁",
  "name": "Partition",
  "category": 6
 },
 {
  "index": 38,
  "char": "C",
  "key": "TID_荷物",
  "name": "Supplies",
  "category": 6
 },
 {
  "index": 39,
  "char": "D",
  "key": "TID_石棺",
  "name": "Coffin",
  "category": 6
 },
 {
  "index": 40,
  "char": "E",
  "key": "TID_壁",
  "name": "Wall",
  "category": 0
 },
 {
  "index": 41,
  "char": "F",
  "key": "TID_扉（平地）",
  "name": "Door",
  "category": 0
 },
 {
  "index": 42,
  "char": "G",
  "key": "TID_扉（床）",
  "name": "Door",
  "category": 0
 },
 {
  "index": 43,
  "char": "H",
  "key": "TID_宝箱",
  "name": "Chest",
  "category": 6
 },
 {
  "index": 44,
  "char": "I",
  "key": "TID_壊宝箱",
  "name": "Scrap",
  "category": 6
 },
 {
  "index": 45,
  "char": "J",
  "key": "TID_床（溶岩）",
  "name": "Floor",
  "category": 11
 },
 {
  "index": 46,
  "char": "K",
  "key": "TID_壊れ床（溶岩）",
  "name": "Hazard",
  "category": 15
 },
 {
  "index": 47,
  "char": "L",
  "key": "TID_溶岩",
  "name": "Lava",
  "category": 6
 },
 {
  "index": 48,
  "char": "M",
  "key": "TID_光の壁",
  "name": "Barrier",
  "category": 0
 },
 {
  "index": 49,
  "char": "N",
  "key": "TID_逆鱗",
  "name": "Ire",
  "category": 16
 },
 {
  "index": 50,
  "char": "O",
  "key": "TID_穴",
  "name": "Sigil",
  "category": 17
 },
 {
  "index": 51,
  "char": "P",
  "key": "TID_背中",
  "name": "Back",
  "category": 1
 },
 {
  "index": 52,
  "char": "Q",
  "key": "TID_翼",
  "name": "Wing",
  "category": 1
 },
 {
  "index": 53,
  "char": "R",
  "key": "TID_高台",
  "name": "Hill",
  "category": 6
 },
 {
  "index": 54,
  "char": "S",
  "key": "TID_村（幻）",
  "name": "Village",
  "category": 9
 },
 {
  "index": 55,
  "char": "T",
  "key": "TID_変化壁（通行不可）",
  "name": "Wall",
  "category": 0
 },
 {
  "index": 56,
  "char": "U",
  "key": "TID_変化壁（通行可）",
  "name": "Breach",
  "category": 11
 },
 {
  "index": 57,
  "char": "V",
  "key": "TID_墓",
  "name": "Grave",
  "category": 6
 },
 {
  "index": 58,
  "char": "W",
  "key": "TID_泉",
  "name": "Spring",
  "category": 6
 },
 {
  "index": 59,
  "char": "X",
  "key": "TID_平地（雪）",
  "name": "Plain",
  "category": 1
 },
 {
  "index": 60,
  "char": "Y",
  "key": "TID_床（雪）",
  "name": "Floor",
  "category": 11
 },
 {
  "index": 61,
  "char": "Z",
  "key": "TID_林（雪）",
  "name": "Woods",
  "category": 2
 },
 {
  "index": 62,
  "char": "!",
  "key": "TID_山（雪）",
  "name": "Mountain",
  "category": 4
 },
 {
  "index": 63,
  "char": "#",
  "key": "TID_橋（雪屋外）",
  "name": "Bridge",
  "category": 1
 },
 {
  "index": 64,
  "char": "$",
  "key": "TID_村（雪）",
  "name": "Village",
  "category": 9
 },
 {
  "index": 65,
  "char": "%",
  "key": "TID_閉じ村（雪）",
  "name": "(Village)",
  "category": 9
 },
 {
  "index": 66,
  "char": "&",
  "key": "TID_廃村（雪）",
  "name": "(Village)",
  "category": 10
 },
 {
  "index": 67,
  "char": "*",
  "key": "TID_扉（雪床）",
  "name": "Door",
  "category": 0
 },
 {
  "index": 68,
  "char": "+",
  "key": "TID_橋（平地）",
  "name": "Bridge",
  "category": 1
 },
 {
  "index": 69,
  "char": "-",
  "key": "TID_床（船）",
  "name": "Floor",
  "category": 11
 },
 {
  "index": 70,
  "char": "=",
  "key": "TID_海（船）",
  "name": "Sea",
  "category": 6
 }
] as const;

export const TERRAIN_CATEGORIES = [ { "def": 0, "avo": 0, "heal": 0 }, { "def": 0, "avo": 0, "heal": 0 }, { "def": 1, "avo": 10, "heal": 0 }, { "def": 0, "avo": 0, "heal": 0 }, { "def": 2, "avo": 20, "heal": 0 }, { "def": 0, "avo": 0, "heal": 0 }, { "def": 0, "avo": 0, "heal": 0 }, { "def": 2, "avo": 20, "heal": 20 }, { "def": 3, "avo": 20, "heal": 20 }, { "def": 0, "avo": 5, "heal": 0 }, { "def": 0, "avo": 0, "heal": 0 }, { "def": 0, "avo": 0, "heal": 0 }, { "def": 0, "avo": 10, "heal": 0 }, { "def": 1, "avo": 10, "heal": 0 }, { "def": 3, "avo": 20, "heal": 20 }, { "def": 0, "avo": 0, "heal": 0 }, { "def": 3, "avo": 20, "heal": 0 }, { "def": 1, "avo": 10, "heal": 0 } ] as const;

export const MOVE_COSTS: readonly (readonly (number | null)[])[] = [ [ null, 1, 2, 2, 4, 5, null, 2, 2, 1, 1, 1, 1, 2, 1, 2, null, null ], [ null, 1, 2, 2, 3, 5, null, 2, 2, 1, 1, 1, 1, 2, 1, 2, null, null ], [ null, 1, 2, 2, null, null, null, 2, 2, 1, 1, 1, 1, 2, 1, 2, null, null ], [ null, 1, 2, 2, null, null, null, 2, 2, 1, 1, 1, 1, 2, 1, 2, null, null ], [ null, 1, 2, 2, 4, null, null, 2, 2, 1, 1, 1, 1, 2, 1, 2, null, null ], [ null, 1, 2, 2, 3, 5, null, 2, 2, 1, 1, 1, 1, 2, 1, 2, null, null ], [ null, 1, 2, 2, 3, null, null, 2, 2, 1, 1, 1, 1, 2, 1, 2, null, null ], [ null, 1, 2, 2, 3, 5, null, 2, 2, 1, 1, 1, 1, 2, 1, 2, null, null ], [ null, 1, 2, 2, 3, 5, null, 2, 2, 1, 1, 1, 1, 2, 1, 2, null, null ], [ null, 1, 2, 1, 4, null, null, 2, 2, 1, 1, 1, 1, 2, 1, 2, null, null ], [ null, 1, 2, 1, 4, null, null, 2, 2, 1, 1, 1, 1, 2, 1, 2, null, null ], [ null, 1, 3, 3, null, null, null, 2, 2, 1, 1, 1, 1, 3, 1, 2, null, null ], [ null, 1, 3, 3, 6, null, null, 2, 2, 1, 1, 1, 1, 3, 1, 2, null, null ], [ null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, null, null ] ];

/** The game's English class names to their movement row. */
export const CLASS_MOVE_ROW: Readonly<Record<string, number>> = {
 "Lord": 0,
 "Great Lord": 1,
 "Tactician": 0,
 "Grandmaster": 1,
 "Cavalier": 11,
 "Knight": 2,
 "Paladin": 12,
 "Great Knight": 12,
 "General": 3,
 "Barbarian": 6,
 "Fighter": 6,
 "Mercenary": 4,
 "Archer": 4,
 "Berserker": 7,
 "Warrior": 7,
 "Hero": 5,
 "Bow Knight": 12,
 "Sniper": 5,
 "Myrmidon": 4,
 "Thief": 8,
 "Swordmaster": 5,
 "Assassin": 7,
 "Trickster": 7,
 "Pegasus Knight": 13,
 "Falcon Knight": 13,
 "Dark Flier": 13,
 "Wyvern Rider": 13,
 "Wyvern Lord": 13,
 "Griffon Rider": 13,
 "Troubadour": 11,
 "Priest": 9,
 "Cleric": 9,
 "Mage": 9,
 "Dark Mage": 9,
 "Valkyrie": 12,
 "War Monk": 10,
 "War Cleric": 10,
 "Sage": 10,
 "Dark Knight": 12,
 "Sorcerer": 10,
 "Dancer": 0,
 "Manakete": 0,
 "Taguel": 0,
 "Soldier": 6,
 "Villager": 6,
 "Merchant": 6,
 "Revenant": 6,
 "Entombed": 6,
 "Conqueror": 12,
 "Lodestar": 1,
 "Grima": 1,
 "Mirage": 0,
 "DUMMY": 0
};
