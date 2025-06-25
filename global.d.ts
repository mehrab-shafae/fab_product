// global.d.ts
declare global {
      function cwd(resolvePath?: string, join?: string): string;
      function asyncHandler(fn: any): (req: any, res: any, next: any) => void;
}

export {};
