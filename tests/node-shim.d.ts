// @types/node eklememek için testlerde kullanılan tek Node API'sinin tipi.
declare module "node:fs" {
  export function readFileSync(path: string): Uint8Array;
  export function readFileSync(path: string, encoding: "utf8"): string;
}
