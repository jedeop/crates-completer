import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { groupBy as _groupBy } from 'lodash';

const CRATES_IO_SEARCH_URL = 'https://crates.io/api/v1/crates?page=1&per_page=5&q=';
const CRATES_IO_VERSION_URL = (crate: string) => `https://crates.io/api/v1/crates/${crate}/versions`;

interface Crate {
  name: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  max_stable_version: string,
  description: string,
}
interface CrateVersion {
  num: string,
  yanked: boolean,
}

class CratesIoCompletionItemProvider implements vscode.CompletionItemProvider {
  public async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionList> {
    const range = new vscode.Range(position.line, 0, position.line, position.character);
    const text = document.getText(range);

    const regex = /\s*(.+?)\s*=\s*"/;

    if (text.includes('=')) {
      if (!regex.test(text)) {
        return new vscode.CompletionList();
      }
      const crate = (regex.exec(text) as RegExpExecArray)[1];

      const res = await fetch(CRATES_IO_VERSION_URL(crate));
      const { versions }: { versions: CrateVersion[] } = await res.json();

      const items = versions.filter(version => !version.yanked).map(({ num: version }, i) => {
        const item = new vscode.CompletionItem(version, vscode.CompletionItemKind.Constant);
        item.insertText = new vscode.SnippetString(`${version}`);
        item.sortText = `${i}`;
        return item;
      });

      return new vscode.CompletionList(items, false);
    } else {
      const res = await fetch(`${CRATES_IO_SEARCH_URL}${text}`);
      const { crates }: { crates: Crate[] } = await res.json();

      const items = crates.map(crate => {
        const item = new vscode.CompletionItem(crate.name, vscode.CompletionItemKind.Property);
        item.insertText = new vscode.SnippetString(`${crate.name} = "\${0:${crate.max_stable_version}}"`);
        item.documentation = new vscode.MarkdownString(`${crate.description}  \n[See on crates.io](https://crates.io/crates/${crate.name})`);
        return item;
      });

      return new vscode.CompletionList(items, true);
    }

  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.languages.registerCompletionItemProvider(
    { language: 'toml', pattern: '**/Cargo.toml' },
    new CratesIoCompletionItemProvider(),
  ));
}

export function deactivate() { }
