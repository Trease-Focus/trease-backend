import type { Context } from "baojs";
import type { Config } from "../types/config";
import type { GeneratorResult } from "../types/generator-result";
import type { ChildProcessWithoutNullStreams } from "child_process";

export interface Generate {
    generate(ctx:Context,onStream?:(process:ChildProcessWithoutNullStreams,videoStream:ChildProcessWithoutNullStreams['stdout']) => void, CONFIG?: Config): Promise<GeneratorResult>;
    getInfo(Config?: Config): Promise<GeneratorResult>;
}