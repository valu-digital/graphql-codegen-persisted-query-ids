export function usePregeneratedHashed(hashes: {
    [operationsName: string]: string | undefined;
}) {
    return (doc: import("graphql").DocumentNode) => {
        const operationDefinition = doc.definitions.find(
            def => def.kind === "OperationDefinition",
        );

        if (
            !operationDefinition ||
            operationDefinition.kind !== "OperationDefinition"
        ) {
            console.error("Cannot find OperationDefinition from", doc);
            throw new Error("Operation missing from graphql query");
        }

        if (!operationDefinition.name) {
            throw new Error("name missing from operation definition");
        }

        const hash = hashes[operationDefinition.name.value];

        if (!hash) {
            throw new Error(
                "Cannot find pregerated has for " +
                    operationDefinition.name.value,
            );
        }

        return hash;
    };
}
