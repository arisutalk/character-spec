import { z } from "zod";
import { ImageURLSchema, unique } from "@/types/v0/utils";

export const AssetEntitySchema = z.object({
    url: ImageURLSchema.meta({ description: "The URL of the asset." }),
    mimeType: z.string().meta({
        description: "MIME type of the asset. Usually `image/*` or `video/*`.",
    }),
    name: z.string().meta({
        description:
            "The name of the asset. Used as the file name. Should be unique.",
    }),
});

/**
 * @see {@link AssetsSetting}
 */
export const AssetsSettingSchema = z
    .object({
        assets: z
            .array(AssetEntitySchema)
            .refine(unique("name"), { message: "Not unique key: name" })
            .meta({ description: "The assets of the character." }),
        inlays: z
            .array(AssetEntitySchema)
            .refine(unique("name"), { message: "Not unique key: name" })
            .meta({
                description:
                    "The inlays of the character. It is not intended to be exported as public.",
            }),
    })
    .meta({ description: "Settings for character assets." });

/**
 * This is the settings for character assets.
 */
export type AssetsSetting = z.infer<typeof AssetsSettingSchema>;
