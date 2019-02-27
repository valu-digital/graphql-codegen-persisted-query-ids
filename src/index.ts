import crypto from "crypto";
import { print } from "graphql";
import { PluginFunction } from "graphql-codegen-core";

function createHash(def: any) {
    return crypto
        .createHash("sha256")
        .update(print(def), "utf8")
        .digest()
        .toString("hex");
}

export interface PluginConfig {
    output: "server" | "client" | undefined;
}

export const plugin: PluginFunction<PluginConfig> = (
    schema,
    documents,
    config,
) => {
    if (config.output !== "client" && config.output !== "server") {
        throw new Error(
            "graphql-codegen-persisted-query-id must configure output to 'server' or 'client'",
        );
    }

    const clientOutput: { [operationName: string]: string } = {};
    const serverOutput: { [hash: string]: string } = {};

    for (const doc of documents) {
        let fragments = "";

        for (const def of doc.content.definitions) {
            if (def.kind === "FragmentDefinition") {
                fragments += print(def) + "\n";
            }

            if (def.kind === "OperationDefinition") {
                if (!def.name) {
                    throw new Error("OperationDefinition missing name");
                }

                const hash = createHash(def);
                clientOutput[def.name.value] = hash;
                serverOutput[hash] = fragments + print(def);
            }
        }
    }

    const out = config.output === "server" ? serverOutput : clientOutput;
    return JSON.stringify(out, null, "   ");
};
