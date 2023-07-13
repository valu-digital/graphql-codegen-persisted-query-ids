import crypto from "crypto";
import {
    print,
    DocumentNode,
    OperationDefinitionNode,
    visit,
    FieldNode,
    FragmentDefinitionNode,
    Location,
    Kind,
} from "graphql";

import { PluginFunction } from "@graphql-codegen/plugin-helpers";

type Definition = FragmentDefinitionNode | OperationDefinitionNode;

function createHash(s: string, config: PluginConfig) {
    return crypto
        .createHash(config.algorithm || "sha256")
        .update(s, "utf8")
        .digest()
        .toString("hex");
}

function printDefinitions(definitions: (Definition | DocumentNode)[]) {
    return definitions.map(print).join("\n");
}

const TYPENAME_FIELD: FieldNode = {
    kind: Kind.FIELD,
    name: {
        kind: Kind.NAME,
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
                const skip = selections.some((selection) => {
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
    algorithm?: string;
}

export function findUsedFragments(
    operation: OperationDefinitionNode | FragmentDefinitionNode,
    knownFragments: ReadonlyMap<string, FragmentDefinitionNode>,
    _usedFragments?: Map<string, FragmentDefinitionNode>,
) {
    const usedFragments = _usedFragments
        ? _usedFragments
        : new Map<string, FragmentDefinitionNode>();

    visit(operation, {
        FragmentSpread: {
            enter(node) {
                const frag = knownFragments.get(node.name.value);
                if (frag) {
                    usedFragments.set(node.name.value, frag);
                    findUsedFragments(frag, knownFragments, usedFragments);
                } else {
                    throw new Error("Unknown fragment: " + node.name.value);
                }
            },
        },
    });

    return usedFragments;
}

export function findFragments(docs: (DocumentNode | FragmentDefinitionNode)[]) {
    const fragments = new Map<string, FragmentDefinitionNode>();

    for (const doc of docs) {
        visit(doc, {
            FragmentDefinition: {
                enter(node) {
                    fragments.set(node.name.value, node);
                },
            },
        });
    }

    return fragments;
}

export function generateQueryIds(docs: DocumentNode[], config: PluginConfig) {
    docs = docs.map(addTypenameToDocument);

    const out: {
        [queryName: string]: {
            hash: string;
            query: string;
            usesVariables: boolean;
            loc?: Location;
        };
    } = {};

    const knownFragments = findFragments(docs);

    for (const doc of docs) {
        visit(doc, {
            OperationDefinition: {
                enter(def) {
                    if (!def.name) {
                        throw new Error("OperationDefinition missing name");
                    }

                    const usedFragments = findUsedFragments(
                        def,
                        knownFragments,
                    );

                    const query = printDefinitions([
                        ...Array.from(usedFragments.values()),
                        def,
                    ]);

                    const hash = createHash(query, config);

                    const usesVariables = Boolean(
                        def.variableDefinitions &&
                            def.variableDefinitions.length > 0,
                    );

                    out[def.name.value] = {
                        hash,
                        query,
                        usesVariables,
                        loc: doc.loc,
                    };
                },
            },
        });
    }

    return out;
}

export const format = {
    server(queries: ReturnType<typeof generateQueryIds>) {
        const out: Record<string, string> = {};
        for (const queryName of Object.keys(queries)) {
            out[queries[queryName].hash] = queries[queryName].query;
        }

        return out;
    },

    client(queries: ReturnType<typeof generateQueryIds>) {
        const out: Record<string, string> = {};
        for (const queryName of Object.keys(queries)) {
            out[queryName] = queries[queryName].hash;
        }
        return out;
    },
};

export const plugin: PluginFunction<PluginConfig, string> = (
    _schema,
    documents,
    config,
) => {
    const queries = generateQueryIds(
        documents.map((doc) => {
            // graphql-code-generator moved from .content to .document at some point.
            // Try to work with both. Must use any since the tests can only have
            // one version of the typings
            const anyDoc = doc as any;
            const docNode: DocumentNode = anyDoc.content || anyDoc.document;
            return docNode;
        }),
        config,
    );

    let out: Record<string, string> = {};

    if (config.output === "client") {
        out = format.client(queries);
    } else if (config.output === "server") {
        out = format.server(queries);
    } else {
        throw new Error(
            "graphql-codegen-persisted-query-id must configure output to 'server' or 'client'",
        );
    }

    return JSON.stringify(out, null, "   ");
};
