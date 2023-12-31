import { Injectable } from '@angular/core';
import {
  OnReadEvent,
  OnScaleConnectedEvent,
  OnScaleDisconnectedEvent,
  ScaleStatus,
  USBScale
} from "@kduma-autoid/capacitor-usb-scale";
import {App} from "@capacitor/app";

type OnReadCallback = (correct: boolean, status: ScaleStatus|null, weight: number) => void;
type OnConnectionStatusChangedCallback = (connected: boolean) => void;

@Injectable({
  providedIn: 'root'
})
export class UsbScaleService {
  private _connected: boolean = false;

  private _lastStatus: ScaleStatus|null = null;
  private _lastWeight: number = 0;
  private _isCorrectStatus: boolean = false;

  private _onReadCallback: OnReadCallback | undefined;
  private _onConnectionStatusChanged: OnConnectionStatusChangedCallback | undefined;

  constructor() {
    USBScale.addListener('onRead', (data) => this.onRead(data));
    USBScale.addListener('onScaleDisconnected', (data) => this.onScaleDisconnected(data));
    USBScale.addListener('onScaleConnected', (data) => this.onScaleConnected(data));
  }

  get lastStatus(): ScaleStatus|null {
    return this._lastStatus;
  }

  get lastWeight(): number {
    return this._lastWeight;
  }

  get isCorrectStatus(): boolean {
    return this._isCorrectStatus;
  }

  set onReadCallback(value: OnReadCallback | undefined) {
    this._onReadCallback = value;

    this._onReadCallback?.(this.isCorrectStatus, this.lastStatus, this.lastWeight);
  }

  set onConnectionStatusChanged(value: OnConnectionStatusChangedCallback | undefined) {
    this._onConnectionStatusChanged = value;
    this._onConnectionStatusChanged?.(this.connected);
  }

  get connected(): boolean {
    return this._connected;
  }

  public async connect(device_id?: string) {
    await USBScale.open(device_id ? { device_id: device_id } : undefined);

    this._connected = true;

    this._onConnectionStatusChanged?.(this.connected);
  }

  public async disconnect() {
    await USBScale.close();

    this._lastStatus = null;
    this._lastWeight = 0;
    this._connected = false;

    this._onConnectionStatusChanged?.(this.connected);
  }

  private onRead(data: OnReadEvent) {
    this._lastStatus = data.status;
    this._lastWeight = data.weight;
    this._isCorrectStatus = data.status == ScaleStatus.Zero || data.status == ScaleStatus.InMotion || data.status == ScaleStatus.Stable;

    this._onReadCallback?.(this.isCorrectStatus, this.lastStatus, this.lastWeight);
  }

  private onScaleDisconnected(data: OnScaleDisconnectedEvent) {
    this._lastStatus = null;
    this._lastWeight = 0;
    this._connected = false;

    this._onConnectionStatusChanged?.(this.connected);
  }

  private async onScaleConnected(data: OnScaleConnectedEvent) {
    let p = await USBScale.hasPermission({ device_id: data.device.id });
    if (p.permission) {
      try {
        await this.connect(data.device.id);
      } catch (err) {
        console.log(err)
      }
      return;
    }

    let listener = App.addListener('resume', async () => {
      await listener.remove();

      let p = await USBScale.hasPermission({ device_id: data.device.id });
      if (!p.permission) {
        console.log("No permissions given.");
        return;
      }

      try {
        await this.connect(data.device.id);
      } catch (err) {
        console.log(err)
      }
    });
  }
}
