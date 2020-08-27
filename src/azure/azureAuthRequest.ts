/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AuthRequest } from 'aad-library';
import { SimpleWebServer } from './simpleWebServer';
import * as crypto from 'crypto';
import * as http from 'http';
import * as path from 'path';
import { promises as fs } from 'fs';
import * as vscode from 'vscode';
import { AzureLogger } from '../azure/azureLogger';

export class AzureAuthRequest implements AuthRequest {
    simpleWebServer: SimpleWebServer;
    serverPort: string;
    nonce: string;
    context: vscode.ExtensionContext;
    logger: AzureLogger;

    constructor(context: vscode.ExtensionContext, logger: AzureLogger) {
        this.simpleWebServer = new SimpleWebServer();
        this.serverPort = undefined;
        this.nonce = crypto.randomBytes(16).toString('base64');
        this.context = context;
        this.logger = logger;
    }

    public getState(): string {
        return `${this.serverPort},${encodeURIComponent(this.nonce)}`;
    }

    public async getAuthorizationCode(signInUrl: string, authComplete: Promise<void>): Promise<string> {
        // await vscode.env.openExternal(vscode.Uri.parse(signInUrl));
        let mediaPath = path.join(this.context.extensionPath, 'media');
        // media path goes here - working directory for this extension
        const sendFile = async (res: http.ServerResponse, filePath: string, contentType: string): Promise<void> => {
            let fileContents;
            try {
                fileContents = await fs.readFile(filePath);
            } catch (ex) {
                this.logger.error(ex);
                res.writeHead(400);
                res.end();
                return;
            }

            res.writeHead(200, {
                'Content-Length': fileContents.length,
                'Content-Type': contentType
            });

            res.end(fileContents);
        };

        this.simpleWebServer.on('/landing.css', (req, reqUrl, res) => {
            sendFile(res, path.join(mediaPath, 'landing.css'), 'text/css; charset=utf-8').catch(this.logger.error);
        });

        this.simpleWebServer.on('/SignIn.svg', (req, reqUrl, res) => {
            sendFile(res, path.join(mediaPath, 'SignIn.svg'), 'image/svg+xml').catch(this.logger.error);
        });

        this.simpleWebServer.on('/signin', (req, reqUrl, res) => {
            let receivedNonce: string = reqUrl.query.nonce as string;
            receivedNonce = receivedNonce.replace(/ /g, '+');

            if (receivedNonce !== encodeURIComponent(this.nonce)) {
                res.writeHead(400, { 'content-type': 'text/html' });
                // res.write(localize('azureAuth.nonceError', 'Authentication failed due to a nonce mismatch, please close Azure Data Studio and try again.'));
                res.end();
                this.logger.error('nonce no match', receivedNonce, this.nonce);
                return;
            }
            res.writeHead(302, { Location: signInUrl });
            res.end();
        });

        return new Promise<string>((resolve, reject) => {
            this.simpleWebServer.on('/callback', (req, reqUrl, res) => {
                const state = reqUrl.query.state as string ?? '';
                const code = reqUrl.query.code as string ?? '';

                const stateSplit = state.split(',');
                if (stateSplit.length !== 2) {
                    res.writeHead(400, { 'content-type': 'text/html' });
                    // res.write(localize('azureAuth.stateError', 'Authentication failed due to a state mismatch, please close ADS and try again.'));
                    res.end();
                    reject(new Error('State mismatch'));
                    return;
                }

                if (stateSplit[1] !== encodeURIComponent(this.nonce)) {
                    res.writeHead(400, { 'content-type': 'text/html' });
                    // res.write(localize('azureAuth.nonceError', 'Authentication failed due to a nonce mismatch, please close Azure Data Studio and try again.'));
                    res.end();
                    reject(new Error('Nonce mismatch'));
                    return;
                }

                resolve(code);

                authComplete.then(() => {
                    sendFile(res, path.join(mediaPath, 'landing.html'), 'text/html; charset=utf-8').catch(console.error);
                }, (ex: Error) => {
                    res.writeHead(400, { 'content-type': 'text/html' });
                    res.write(ex.message);
                    res.end();
                });
            });
        });

        return;

        // check the state that is returned from the local web server for the server port and nonce


    // private addServerListeners(server: SimpleWebServer, )
    }

    public async displayDeviceCodeScreen(msg: string, userCode: string, verificationUrl: string): Promise<void> {
        // create a notification with the device code message, usercode, and verificationurl


        return;
    }

    public async startServer(): Promise<void> {
        try {
            this.serverPort = await this.simpleWebServer.startup();
        } catch (ex) {
            // const msg = localize('azure.serverCouldNotStart', 'Server could not start. This could be a permissions error or an incompatibility on your system. You can try enabling device code authentication from settings.');
            // throw new AzureAuthError(msg, 'Server could not start', ex);
        }
    }
}


