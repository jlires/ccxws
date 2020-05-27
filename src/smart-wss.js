const { EventEmitter } = require("events");

class SmartWss extends EventEmitter {
  constructor(wssPath) {
    super();
    this._wssPath = wssPath;
    this._retryTimeoutMs = 15000;
    this._connected = false;
  }

  /**
   * Gets if the socket is currently connected
   */
  get isConnected() {
    return this._connected;
  }

  /**
   * Attempts to connect
   */
  async connect() {
    await this._attemptConnect();
  }

  /**
   * Closes the connection
   */
  close() {
    this.emit("closing");
    if (this._wss) {
      this._wss.removeAllListeners();
      this._wss.addEventListener("close", () => this.emit("closed"));
      this._wss.addEventListener("error", err => {
        if (err.message !== "WebSocket was closed before the connection was established") return;
        this.emit("error", err);
      });
      this._wss.close();
    }
  }

  /**
   * Sends the data if the socket is currently connected.
   * Otherwise the consumer needs to retry to send the information
   * when the socket is connected.
   */
  send(data) {
    if (this._connected) {
      try {
        this._wss.send(data);
      } catch (e) {
        this.emit("error", e);
      }
    }
  }

  /////////////////////////

  /**
   * Attempts a connection and will either fail or timeout otherwise.
   */
  _attemptConnect() {
    return new Promise(resolve => {
      let wssPath = this._wssPath;
      this.emit("connecting");
      this._wss = new WebSocket(wssPath);

      this._wss.addEventListener("open", () => {
        this._connected = true;
        this.emit("open"); // deprecated
        this.emit("connected");
        resolve();
      });
      this._wss.addEventListener("close", () => this._closeCallback());
      this._wss.addEventListener("error", err => this.emit("error", err));
      this._wss.addEventListener("message", msg => this.emit("message", msg.data));
    });
  }

  /**
   * Handles the closing event by reconnecting
   */
  _closeCallback() {
    this._connected = false;
    this._wss = null;
    this.emit("disconnected");
    this._retryConnect();
  }

  /**
   * Perform reconnection after the timeout period
   * and will loop on hard failures
   */
  async _retryConnect() {
    // eslint-disable-next-line
    while (true) {
      try {
        await wait(this._retryTimeoutMs);
        await this._attemptConnect();
        return;
      } catch (ex) {
        this.emit("error", ex);
      }
    }
  }
}

async function wait(timeout) {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

module.exports = SmartWss;
