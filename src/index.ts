import crypto from "crypto";
import {
    print,
    DocumentNode,
    OperationDefinitionNode,
    visit,
    FieldNode,
    FragmentDefinitionNode,
    DefinitionNode,
} from "graphql";
import { PluginFunction } from "graphql-codegen-core";

type Definition = FragmentDefinitionNode | OperationDefinitionNode;

function createHash(s: string) {
    return crypto
        .createHash("sha256")
        .update(s, "utf8")
        .digest()
        .toString("hex");
}

function printDefinitions(definitions: (Definition | DocumentNode)[]) {
    return definitions.map(print).join("\n");
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
}

export function findFragmentSpreadsNames(operation: OperationDefinitionNode) {
    const fragmentNames = new Set<string>();

    visit(operation, {
        FragmentSpread: {
            enter(node) {
                fragmentNames.add(node.name.value);
            },
        },
    });

    return fragmentNames;
}

export function findFragments(docs: DocumentNode[]) {
    const fragments: FragmentDefinitionNode[] = [];

    for (const doc of docs) {
        visit(doc, {
            FragmentDefinition: {
                enter(node) {
                    fragments.push(node);
                },
            },
        });
    }

    return fragments;
}

export function generateQueryIds(docs: DocumentNode[], config: PluginConfig) {
    docs = docs.map(addTypenameToDocument);

    const out: { [key: string]: string } = {};

    const fragments = findFragments(docs);

    for (const doc of docs) {
        visit(doc, {
            OperationDefinition: {
                enter(def) {
                    if (!def.name) {
                        throw new Error("OperationDefinition missing name");
                    }

                    const usedFragmentNames = findFragmentSpreadsNames(def);

                    const usedFragments = fragments.filter(frag =>
                        usedFragmentNames.has(frag.name.value),
                    );

                    const query = printDefinitions([...usedFragments, def]);
                    const hash = createHash(query);

                    if (config.output === "client") {
                        out[def.name.value] = hash;
                    } else {
                        out[hash] = query;
                    }
                },
            },
        });
    }

    return out;
}

export const plugin: PluginFunction<PluginConfig> = (
    _schema,
    documents,
    config,
) => {
    if (config.output !== "client" && config.output !== "server") {
        throw new Error(
            "graphql-codegen-persisted-query-id must configure output to 'server' or 'client'",
        );
    }

    const out = generateQueryIds(documents.map(doc => doc.content), config);

    return JSON.stringify(out, null, "   ");
};
