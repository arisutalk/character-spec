import * as v from "valibot";
import { ImageURLSchema, unique } from "@/types/v0/utils";
export const AssetEntitySchema = v.object({
    /**
     * The URL of the asset.
     */
    url: ImageURLSchema,
    /**
     * MIME type of the asset. Usually `image/*` or `video/*`.
     */
    mimeType: v.string(),
    /**
     * The name of the asset.
     * It will be used as the file name. Should be unique between assets.
     */
    name: v.string(),
});

/**
 * @see {@link AssetsSetting}
 */
export const AssetsSettingSchema = v.object({
    /**
     * The URL of the character's avatar image.
     */
    avatarUrl: v.optional(ImageURLSchema),
    /**
     * The assets of the character.
     */
    assets: v.pipe(v.array(AssetEntitySchema), unique("name")),
});

/**
 * This is the settings for character assets.
 */
export type AssetsSetting = v.InferOutput<typeof AssetsSettingSchema>;
