import crypto from "crypto";
import {
    print,
    DocumentNode,
    OperationDefinitionNode,
    visit,
    FieldNode,
} from "graphql";
import { PluginFunction } from "graphql-codegen-core";

function createHash(def: any) {
    return crypto
        .createHash("sha256")
        .update(print(def), "utf8")
        .digest()
        .toString("hex");
}

const TYPENAME_FIELD: FieldNode = {
    kind: "Field",
    name: {
        kind: "Name",
        value: "__typename",
    },
};

// From apollo-client https://github.com/apollographql/apollo-client/blob/3a9dfe268979618180823eef93e96ab87468449c/packages/apollo-utilities/src/transform.ts
function addTypenameToDocument(doc: DocumentNode): DocumentNode {
    return visit(doc, {
        SelectionSet: {
            enter(node, _key, parent) {
                // Don't add __typename to OperationDefinitions.
                if (
                    parent &&
                    (parent as OperationDefinitionNode).kind ===
                        "OperationDefinition"
                ) {
                    return;
                }

                // No changes if no selections.
                const { selections } = node;
                if (!selections) {
                    return;
                }

                // If selections already have a __typename, or are part of an
                // introspection query, do nothing.
                const skip = selections.some(selection => {
                    return (
                        selection.kind === "Field" &&
                        ((selection as FieldNode).name.value === "__typename" ||
                            (selection as FieldNode).name.value.lastIndexOf(
                                "__",
                                0,
                            ) === 0)
                    );
                });
                if (skip) {
                    return;
                }

                // Create and return a new SelectionSet with a __typename Field.
                return {
                    ...node,
                    selections: [...selections, TYPENAME_FIELD],
                };
            },
        },
    });
}

export interface PluginConfig {
    output: "server" | "client" | undefined;
    addTypeName?: boolean;
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

        const content = config.addTypeName
            ? addTypenameToDocument(doc.content)
            : doc.content;

        for (const def of content.definitions) {
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