declare module 'agora-rtc-sdk-ng' {
  export interface IMicrophoneAudioTrack {
    trackMediaType: 'audio';
    muted: boolean;
    mute(): void;
    unmute(): void;
    close(): void;
  }

  export interface ICameraVideoTrack {
    trackMediaType: 'video';
    muted: boolean;
    mute(): void;
    unmute(): void;
    close(): void;
    play(element: HTMLElement): void;
  }

  export interface AgoraRTCClient {
    join(appId: string, channel: string, token: string | null, uid: number | null): Promise<number>;
    leave(): Promise<void>;
    publish(track: IMicrophoneAudioTrack | ICameraVideoTrack): Promise<void>;
    on(event: string, callback: (evt: any) => void): void;
  }

  export interface AgoraRTC {
    createClient(config: { mode: string; codec: string }): AgoraRTCClient;
    createMicrophoneAudioTrack(): Promise<IMicrophoneAudioTrack>;
    createCameraVideoTrack(): Promise<ICameraVideoTrack>;
  }

  export type { AgoraRTCClient };
} 