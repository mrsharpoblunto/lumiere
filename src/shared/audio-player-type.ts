export interface IAudioPlayer {
  volume(volume: number): void;
  play(file: string): void;
  queue(file: string): void;
  cleanup?: () => void;
}
