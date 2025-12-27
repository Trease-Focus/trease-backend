import { mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { entities } from '../src/entities';
import type { Config } from '../src/types/config';
import { generateGridVideo } from '../src/grid_video';

const SEED = '6969696969696969';
const OUTPUT_DIR = path.join(__dirname, '..', 'cache', 'video');
const IMAGES_DIR = path.join(__dirname, '..', 'cache', 'images');
const TREE_SCALE = 0.8;

/**
 * VideoGenerator - Generates videos for each entity
 * and saves them under cache/video
 */
export class VideoGenerator {
    private seed: string;
    private outputDir: string;

    constructor(seed: string = SEED, outputDir: string = OUTPUT_DIR) {
        this.seed = seed;
        this.outputDir = outputDir;
    }

    private async ensureOutputDir(): Promise<void> {
        if (!existsSync(this.outputDir)) {
            await mkdir(this.outputDir, { recursive: true });
            console.log(`✅ Created output directory: ${this.outputDir}`);
        }
    }

    async generateAll(): Promise<void> {
        console.log(`\n🎬 Video Generator`);
        console.log(`   Seed: ${this.seed}`);
        console.log(`   Output: ${this.outputDir}\n`);

        await this.ensureOutputDir();

        const entityConfig: Config = {
            photoOnly: false,
            width: 480,
            height: 480,
            fps: 25,
            durationSeconds: 30,
            seed: this.seed,
            filename: 'video.webm',
            imageFilename: 'image.png',
            padding: 80,
            save_as_file: true
        };

        console.log(`📦 Generating videos for ${entities.size} entities...\n`);

        for (const [entityName, generator] of entities) {
            console.log(`🔄 Processing: ${entityName}`);

            try {
                const result = await generator.generate(null as any, undefined, entityConfig);

                if (result.videoPath) {
                    const treePngPath = path.join(IMAGES_DIR, `${entityName}.png`);
                    const gridOutputPath = path.join(this.outputDir, `${entityName}.webm`);
                    
                    console.log(`  🎬 Generating grid video...`);
                    await generateGridVideo(treePngPath, result.videoPath, gridOutputPath, TREE_SCALE);
                    console.log(`  ✓ Saved grid video: ${gridOutputPath}`);
                    
                    // Delete the original non-grid video
                    if (existsSync(result.videoPath)) {
                        await unlink(result.videoPath);
                        console.log(`  🗑️ Deleted temp video: ${result.videoPath}`);
                    }
                } else {
                    console.error(`  ✗ No video generated for ${entityName}`);
                }
            } catch (error) {
                console.error(`  ✗ Error generating ${entityName}:`, error);
            }
        }

        console.log(`\n✅ Video generation complete!`);
        console.log(`   Output directory: ${this.outputDir}\n`);
    }

    async generateForEntity(entityName: string): Promise<void> {
        console.log(`\n🎬 Video Generator - ${entityName}`);
        console.log(`   Seed: ${this.seed}\n`);

        await this.ensureOutputDir();

        const generator = entities.get(entityName);
        if (!generator) {
            console.error(`Entity "${entityName}" not found. Available entities:`);
            for (const name of entities.keys()) {
                console.log(`  - ${name}`);
            }
            return;
        }

        const entityConfig: Config = {
            photoOnly: false,
            width: 480,
            height: 480,
            fps: 25,
            durationSeconds: 30,
            seed: this.seed,
            filename: 'video.webm',
            imageFilename: 'image.png',
            padding: 80,
            save_as_file: true
        };

        console.log(`🔄 Processing: ${entityName}`);

        try {
            const result = await generator.generate(null as any, undefined, entityConfig);

            if (result.videoPath) {
                const treePngPath = path.join(IMAGES_DIR, `${entityName}.png`);
                const gridOutputPath = path.join(this.outputDir, `${entityName}.webm`);
                
                console.log(`  🎬 Generating grid video...`);
                await generateGridVideo(treePngPath, result.videoPath, gridOutputPath, TREE_SCALE);
                console.log(`  ✓ Saved grid video: ${gridOutputPath}`);
                
                // Delete the original non-grid video
                if (existsSync(result.videoPath)) {
                    await unlink(result.videoPath);
                    console.log(`  🗑️ Deleted temp video: ${result.videoPath}`);
                }
            } else {
                console.error(`  ✗ No video generated for ${entityName}`);
            }
        } catch (error) {
            console.error(`  ✗ Error generating ${entityName}:`, error);
        }

        console.log(`\n✅ Done!`);
    }
}

async function main() {
    const generator = new VideoGenerator(SEED, OUTPUT_DIR);
    const entityArg = process.argv[2];

    if (entityArg) {
        await generator.generateForEntity(entityArg);
    } else {
        await generator.generateAll();
    }
}

main().catch(console.error);
