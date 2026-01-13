import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import { createRule } from '#package/utils/create-rule.js'

type MessageIds = 'avoidMultipleSpecifiersImports' | 'avoidUnsortedImports'

type Options = [
  {
    ignorePaths?: {
      name: string
      importNames?: string[]
    }[]
  },
]

export default createRule<Options, MessageIds>({
  name: 'organize-imports',
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Organize imports.',
    },
    messages: {
      avoidMultipleSpecifiersImports:
        'Avoid multiple specifiers on import declarations.',
      avoidUnsortedImports:
        'Import declarations should be sorted by the specifier.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          ignorePaths: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                importNames: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['name'],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ ignorePaths: [] }],
  create: (context, [{ ignorePaths = [] }]) => ({
    Program: (program) => {
      const sourceCode = context.sourceCode
      const importDeclarations = program.body
        .filter((declaration) => declaration.type === 'ImportDeclaration')
        .filter((declaration) => declaration.specifiers.length > 0)

      if (importDeclarations.length === 0) {
        return
      }

      if (
        importDeclarations.some(
          (declaration) => declaration.specifiers.length > 1,
        )
      ) {
        for (const declaration of importDeclarations) {
          if (declaration.specifiers.length <= 1) {
            continue
          }

          context.report({
            node: declaration,
            messageId: 'avoidMultipleSpecifiersImports',
            fix: (fixer) => {
              const fix = declaration.specifiers
                .map((specifier) => {
                  if (specifier.type === 'ImportSpecifier') {
                    const segments = [`import`]

                    if (declaration.importKind === 'type') {
                      segments.push('type')
                    }

                    segments.push(`{`)

                    if (specifier.importKind === 'type') {
                      segments.push('type')
                    }

                    const importedName =
                      'name' in specifier.imported
                        ? specifier.imported.name
                        : specifier.imported.value

                    if (importedName !== specifier.local.name) {
                      segments.push(`${importedName} as`)
                    }

                    segments.push(
                      `${specifier.local.name} } from '${declaration.source.value}'`,
                    )

                    return segments.join(' ')
                  }

                  if (specifier.type === 'ImportDefaultSpecifier') {
                    const segments = ['import']

                    if (declaration.importKind === 'type') {
                      segments.push('type')
                    }

                    segments.push(
                      `${specifier.local.name} from '${declaration.source.value}'`,
                    )

                    return segments.join(' ')
                  }

                  if (specifier.type === 'ImportNamespaceSpecifier') {
                    return `import * as ${specifier.local.name} from '${declaration.source.value}'`
                  }
                })
                .join('\n')

              return fixer.replaceText(declaration, fix)
            },
          })
        }

        return
      }

      const selectedDeclarations = importDeclarations.filter((declaration) => {
        return ignorePaths.every(
          (path) =>
            path.name !== declaration.source.value &&
            path.importNames?.every((name) =>
              name === 'default'
                ? declaration.specifiers.every(
                    (specifier) =>
                      specifier.type !== AST_NODE_TYPES.ImportDefaultSpecifier,
                  )
                : declaration.specifiers.every(
                    (specifier) =>
                      !(
                        specifier.type === AST_NODE_TYPES.ImportSpecifier &&
                        (specifier.imported.type === AST_NODE_TYPES.Identifier
                          ? specifier.imported.name
                          : specifier.imported.value) === name
                      ),
                  ),
            ),
        )
      })

      const sortedDeclarations = selectedDeclarations.toSorted((a, b) =>
        (a.specifiers[0]?.local.name ?? '').localeCompare(
          b.specifiers[0]?.local.name ?? '',
        ),
      )

      const firstOutOfSortDeclaration = sortedDeclarations.find(
        (declaration, index) => declaration !== selectedDeclarations[index],
      )

      if (firstOutOfSortDeclaration == null) {
        return
      }

      context.report({
        node: firstOutOfSortDeclaration,
        messageId: 'avoidUnsortedImports',
        fix: (fixer) => {
          const fix = sortedDeclarations
            .flatMap((declaration) => {
              const comments = sourceCode.getCommentsBefore(declaration)

              const preserveLeadingComments = (() => {
                const lastComment = comments.at(-1)

                if (lastComment == null) {
                  return true
                }

                return (
                  declaration.loc.start.line - lastComment.loc.end.line <= 1
                )
              })()

              return [
                ...(preserveLeadingComments
                  ? comments.map((comment) => sourceCode.getText(comment))
                  : []),
                sourceCode.getText(declaration),
              ]
            })
            .join('\n')

          /* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
          /* eslint-disable @typescript-eslint/no-non-null-assertion */
          const start = selectedDeclarations[0]?.range[0]!
          const end = selectedDeclarations.at(-1)?.range[1]!
          /* eslint-enable */

          return fixer.replaceTextRange([start, end], fix)
        },
      })
    },
  }),
})
