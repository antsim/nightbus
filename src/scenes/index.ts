import { BootScene } from './BootScene';
import { BusScene } from './BusScene';
import { DebugScene } from './DebugScene';
import { ResultScene } from './ResultScene';

// Single registry of all scenes. The first one is started automatically.
export const SCENES = [BootScene, BusScene, ResultScene, DebugScene];
