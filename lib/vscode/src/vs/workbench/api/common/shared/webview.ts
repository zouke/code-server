/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import type * as vscode from 'vscode';

export interface WebviewInitData {
	readonly remote: {
		readonly isRemote: boolean;
		readonly authority: string | undefined
	};
}

/**
 * Root from which resources in webviews are loaded.
 *
 * This is hardcoded because we never expect to actually hit it. Instead these requests
 * should always go to a service worker.
 */
export const webviewResourceBaseHost = 'vscode-webview.net';

export const webviewRootResourceAuthority = `vscode-resource.${webviewResourceBaseHost}`;

// NOTE@coder: This is a temporary change to include ":*"
// due to the patch we had to make for webview resources.
// See PR#3895 and https://github.com/cdr/code-server/issues/3936 for more details.
export const webviewGenericCspSource = `https://*.${webviewResourceBaseHost}:*`;

/**
 * Construct a uri that can load resources inside a webview
 *
 * We encode the resource component of the uri so that on the main thread
 * we know where to load the resource from (remote or truly local):
 *
 * ```txt
 * ${scheme}+${resource-authority}.vscode-resource.vscode-webview.net/${path}
 * ```
 *
 * @param resource Uri of the resource to load.
 * @param remoteInfo Optional information about the remote that specifies where `resource` should be resolved from.
 */
export function asWebviewUri(
	resource: vscode.Uri,
	remoteInfo?: { authority: string | undefined, isRemote: boolean }
): vscode.Uri {
	if (resource.scheme === Schemas.http || resource.scheme === Schemas.https) {
		return resource;
	}

	if (remoteInfo && remoteInfo.authority && remoteInfo.isRemote && resource.scheme === Schemas.file) {
		resource = URI.from({
			scheme: Schemas.vscodeRemote,
			authority: remoteInfo.authority,
			path: resource.path,
		});
	}

	// NOTE@coder: Add the port separately because if the port is in the domain the
	// URL will be invalid and the browser will not request it.
	const authorityUrl = new URL(`${resource.scheme}://${resource.authority}`);
	return URI.from({
		scheme: Schemas.https,
		authority: `${resource.scheme}+${authorityUrl.hostname}.${webviewRootResourceAuthority}${authorityUrl.port ? (':' + authorityUrl.port) : ''}`,
		path: resource.path,
		fragment: resource.fragment,
		query: resource.query,
	});
}
