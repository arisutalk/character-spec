import { z } from "zod";
import { ReplaceHookSchema } from "@/types/v0/Executables/ReplaceHook";
import { positiveInteger } from "@/types/v0/utils";

/**
 * This is the script for character. It includes hook, script settings, something else.
 */
export const ScriptSettingSchema = z
    .object({
        runtimeSetting: z
            .object({
                mem: positiveInteger.optional().meta({
                    description:
                        "The maximum memory usage of the script, in MB. Not an exact limit. May be exceeded or ignored.",
                }),
            })
            .meta({
                description:
                    "Runtime settings for the script. Controls runtime environment. All values capped at user's configuration.",
            }),
        replaceHooks: ReplaceHookSchema.meta({
            description: "Replace hooks for the script.",
        }),
    })
    .meta({
        description:
            "Script settings for character. Includes hooks and script settings.",
    });
