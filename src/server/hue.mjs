import http from 'http';

export class HueAPI {
  constructor(bridge, user) {
    this.bridge = bridge;
    this.user = user;
  }
  getGroups() {
    return this._httpGet('/groups');
  }
  getGroup(groupId) {
    return this._httpGet(`/groups/${groupId}`);
  }
  putGroup(groupId, data) {
    return this._httpPut(`/groups/${groupId}/action`, data);
  }
  _httpGet(path) {
    return new Promise((resolve, reject) => {
      http
        .get(
          {
            host: this.bridge,
            port: 80,
            path: '/api/' + this.user + path,
          },
          res => {
            res.setEncoding('utf8');
            let body = '';
            res.on('data', data => {
              body += data;
            });
            res.on('end', () => {
              let parsed;
              try {
                parsed = JSON.parse(body);
              } catch (ex) {}
              resolve({statusCode: res.statusCode, body: parsed || body});
            });
          },
        )
        .on('error', e => {
          reject(e);
        });
    });
  }
  _httpPut(path, data) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: this.bridge,
          port: 80,
          method: 'PUT',
          path: '/api/' + this.user + path,
          headers: {'Content-Type': 'application/json'},
        },
        res => {
          res.setEncoding('utf8');
          let body = '';
          res.on('data', data => {
            body += data;
          });
          res.on('end', () => {
            let parsed;
            try {
              parsed = JSON.parse(body);
            } catch (ex) {}
            resolve({statusCode: res.statusCode, body: parsed || body});
          });
        },
      );
      req.on('error', e => {
        reject(e);
      });
      req.write(JSON.stringify(data));
      req.end();
    });
  }
}
