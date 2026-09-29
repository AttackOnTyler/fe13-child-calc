/** The position plan's engine (#261–#266): captured maps, the board, the enemy phase, the hard line and the solver. */
export { capturedMap, isOutdoors, manhattan, onMap, sameTile, terrainAt, tileBonus, tileKey, keyTile, type CapturedMap, type Placement, type Tile } from './captured';
export { boardFromMap, enemyById, forecast, leads, liveEnemies, movement, playFight, playerById, reaches, strikeOrder, threatTiles, type Board, type EnemyPiece, type PlayerPiece } from './board';
export { enemyPhase, folkloreTargeting, wake, type EnemyAction, type Targeting } from './enemy-phase';
export { counterOn, safety, type LethalCounter, type Safety, type UnitSafety } from './safety';
export { actingTiles, actionText, applyAction, attackForecast, menuAt, solvePositions, switched, type ActionForecast, type AttackOutcome, type Command, type PlannedAction, type PositionPlan, type SearchProgress, type SolveOptions, type TurnPlan } from './solve';
export { holdBack, type HoldBack } from './hold-back';
export { lineupBoard, replay, type PositionEvent } from './log';
