import { z } from "zod";
import { FileSchema, unique } from "@/types/v0/utils";

export const AssetEntitySchema = z
    .object({
        mimeType: z.string().meta({
            description:
                "MIME type of the asset. Usually `image/*` or `video/*`.",
        }),
        name: z.string().meta({
            description:
                "The name of the asset. Used as the file name. Should be unique.",
        }),
        data: FileSchema.meta({
            description: "The data of the asset.",
        }),
    })
    .meta({
        description:
            "An asset entity. Represents single asset, via either URL or binary data.",
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
    })
    .meta({ description: "Settings for character assets." });

/**
 * This is the settings for character assets.
 */
export type AssetsSetting = z.infer<typeof AssetsSettingSchema>;
