/// <reference types="vite/client" />
/// <reference types="vite-plugin-glsl/ext" />

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.sass' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.vert' {
  const content: string;
  export default content;
}

declare module '*.frag' {
  const content: string;
  export default content;
}

declare module '*.glsl' {
  const content: string;
  export default content;
}

declare module '*.json' {
  const value: any;
  export default value;
}

declare module '*.jsonc' {
  const value: any;
  export default value;
}

declare module 'upng-js' {
  interface UPNGImage {
    width: number;
    height: number;
    depth: number; // Bit depth: 1, 2, 4, 8, or 16
    ctype: number; // Color type: 0=grayscale, 2=RGB, 3=palette, 4=grayscale+alpha, 6=RGBA
    frames: Array<{
      rect: { x: number; y: number; width: number; height: number };
      delay: number;
      dispose: number;
      blend: number;
    }>;
    data: Uint8Array; // Raw pixel data (decompressed and unfiltered)
    tabs: {
      acTL?: { num_frames: number; num_plays: number };
      pHYs?: { ppuX: number; ppuY: number; unit: number };
    };
  }

  interface UPNG {
    decode(buffer: Uint8Array): UPNGImage | null;
    toRGBA8(img: UPNGImage): Uint8Array[];
    encode(
      imgs: Array<Uint8Array>,
      w: number,
      h: number,
      cnum: number,
      dels?: number[]
    ): Uint8Array;
  }

  const UPNG: UPNG;
  export default UPNG;
}
