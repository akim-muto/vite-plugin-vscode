import { Disposable, Uri, ViewColumn, Webview, WebviewPanel, window } from 'vscode';
// import __getWebviewHtml__ from '@tomjs/vscode-extension-webview';

function uuid() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
  return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}

/**
 * This class manages the state and behavior of HelloWorld webview panels.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering HelloWorld webview panels
 * - Properly cleaning up and disposing of webview resources when the panel is closed
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview panel
 * - Setting message listeners so data can be passed between the webview and extension
 */
export class HelloWorldPanel {
  public static currentPanel: HelloWorldPanel | undefined;
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];

  /**
   * The HelloWorldPanel class private constructor (called only from the render method).
   *
   * @param panel A reference to the webview panel
   * @param extensionUri The URI of the directory containing the extension
   */
  private constructor(panel: WebviewPanel, extensionUri: Uri) {
    this._panel = panel;

    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Set the HTML content for the webview panel
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(this._panel.webview);
  }

  /**
   * Renders the current webview panel if it exists otherwise a new webview panel
   * will be created and displayed.
   *
   * @param extensionUri The URI of the directory containing the extension.
   */
  public static render(extensionUri: Uri) {
    if (HelloWorldPanel.currentPanel) {
      // If the webview panel already exists reveal it
      HelloWorldPanel.currentPanel._panel.reveal(ViewColumn.One);
    } else {
      // If a webview panel does not already exist create and show a new one
      const panel = window.createWebviewPanel(
        // Panel view type
        'showHelloWorld',
        // Panel title
        'Hello World',
        // The editor column the panel should be displayed in
        ViewColumn.One,
        // Extra panel configurations
        {
          // Enable JavaScript in the webview
          enableScripts: true,
          // Restrict the webview to only load resources from the `dist/webview` directories
          localResourceRoots: [Uri.joinPath(extensionUri, 'dist/webview')],
        },
      );

      HelloWorldPanel.currentPanel = new HelloWorldPanel(panel, extensionUri);
    }
  }

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
  public dispose() {
    HelloWorldPanel.currentPanel = undefined;

    // Dispose of the current webview panel
    this._panel.dispose();

    // Dispose of all disposables (i.e. commands) for the current webview panel
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Defines and returns the HTML that should be rendered within the webview panel.
   *
   * @remarks This is also the place where references to the Vue webview build files
   * are created and inserted into the webview HTML.
   *
   * @param webview A reference to the extension webview
   * @param extensionUri The URI of the directory containing the extension
   * @returns A template string literal containing the HTML that should be
   * rendered within the webview panel
   */
  private _getWebviewContent(webview: Webview, extensionUri: Uri) {
    console.log('extensionUri:', extensionUri);
    // The CSS file from the Vue build output
    const stylesUri = getUri(webview, extensionUri, ['dist/webview/assets/index.css']);
    const scriptUri = getUri(webview, extensionUri, ['dist/webview/assets/index.js']);
    // The JS file from the Vue build output
    // const scriptUri = getUri(webview, extensionUri, ['dist', 'webview', 'assets', 'index.js']);
    console.log(
      'scriptUri:',
      getUri(webview, extensionUri, ['dist', 'webview', 'assets', 'index.js']),
    );

    const baseUri = getUri(webview, extensionUri, ['dist/webview']);
    console.log('baseUri:', baseUri, baseUri.toString());

    const nonce = uuid();

    console.log('VITE_DEV_SERVER_URL:', process.env.VITE_DEV_SERVER_URL);

    if (process.env.VITE_DEV_SERVER_URL) {
      // @ts-ignore
      return __getWebviewHtml__({ serverUrl: process.env.VITE_DEV_SERVER_URL });
    }

    // const jsFiles = [
    //   'dist/webview/assets/batchSamplersUniformGroup.js',
    //   'dist/webview/assets/browserAll.js',
    //   'dist/webview/assets/CanvasPool.js',
    //   'dist/webview/assets/localUniformBit.js',
    //   'dist/webview/assets/SharedSystems.js',
    //   'dist/webview/assets/WebGLRenderer.js',
    //   'dist/webview/assets/WebGPURenderer.js',
    //   'dist/webview/assets/webworkerAll.js',
    // ];

    const jsDistFiles = process.env.VITE_DIST_FILES;
    let jsFiles = [];
    try {
      if (jsDistFiles) {
        jsFiles = JSON.parse(jsDistFiles || '');
      }
    } catch {}

    const injectScripts = jsFiles
      .map(
        s =>
          `<script type="module" src="${getUri(webview, extensionUri, [
            s,
          ])}" nonce="${nonce}"></script>`,
      )
      .join('\n');

    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval';">
          <base href="${baseUri}" />
          ${injectScripts}
          <script type="module" crossorigin nonce="${nonce}" src="${scriptUri}"></script>
          <link rel="stylesheet" crossorigin href="${stylesUri}">
          <title>Hello World</title>
        </head>
        <body>
          <div id="app"></div>
        </body>
      </html>
    `;
  }

  /**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is recieved.
   *
   * @param webview A reference to the extension webview
   * @param context A reference to the extension context
   */
  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.command;
        const text = message.text;
        console.log(`command: ${command}`);

        switch (command) {
          case 'hello':
            // Code that should run in response to the hello message command
            window.showInformationMessage(text);
            return;
          // Add more switch case statements here as more webview message commands
          // are created within the webview context (i.e. inside media/main.js)
        }
      },
      undefined,
      this._disposables,
    );
  }
}
