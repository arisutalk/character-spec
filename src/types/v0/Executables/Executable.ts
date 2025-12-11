import * as v from "valibot";
import { ReplaceHookSchema } from "@/types/v0/Executables/ReplaceHook";
import { positiveInteger } from "@/types/v0/utils";

/**
 * This is the script for character. It includes hook, script settings, something else.
 */
export const ScriptSettingSchema = v.object({
    /**
     * Runtime settings for the script.
     * This is used to control the runtime environment of the script.
     * All values are capped at user's configuration, to prevent malicious script.
     */
    runtimeSetting: v.object({
        /**
         * The maximum memory usage of the script, in MB.
         * Note that this is not a exact limit. It may be exceeded by a small amount, or ignored.
         */
        mem: v.optional(positiveInteger),
    }),
    /**
     * Replace hooks for the script.
     * @see {@link ReplaceHookSchema}
     */
    replaceHooks: ReplaceHookSchema,
});
