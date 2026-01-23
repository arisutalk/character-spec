import { z } from "zod";
import { FileSchema, unique } from "@/types/v0/utils";

export const AssetEntitySchema = z
    .object({
        id: z.string().meta({
            description:
                "The ID of the asset. Used as the key. Should be unique.",
        }),
        mimeType: z.string().meta({
            description:
                "MIME type of the asset. Usually `image/*` or `video/*`.",
        }),
        name: z.string().meta({
            description:
                "The name of the asset. Used as the file name. " +
                "If multiple assets have the same name, random one will be used.",
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
            .default([])
            .refine(unique("id"), { message: "Not unique key: id" })
            .meta({ description: "The assets of the character." }),
    })
    .prefault({})
    .meta({ description: "Settings for character assets." });

/**
 * This is the settings for character assets.
 */
export type AssetsSetting = z.infer<typeof AssetsSettingSchema>;
