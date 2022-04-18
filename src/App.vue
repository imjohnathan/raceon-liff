<script setup>
import liff from "@line/liff";
import store from "store";
import axios from "axios";
</script>

<template>
  <div v-if="work.loading" class="flex-box center-box">
    <div class="min-height-40">
      <i class="gg-spinner"></i>
    </div>
    <p class="paragraph">請稍候...</p>
  </div>

  <div v-if="work.debug">
    <ul>
      <li><a @click="reboot()">重來</a></li>
      <li v-if="basic.customer"><a @click="unbindLiff()">解除綁定</a></li>
    </ul>
    <pre style="word-break: break-all; white-space: break-spaces">{{
      $data
    }}</pre>
  </div>

  <div v-show="basic.cta_btn != ''" class="btn-wrapper">
    <button
      @click="openLink(basic.cta_btn, cta_external)"
      class="btn-redirect"
    >
      點我繼續
    </button>
    <button
      @click="openLink('https://lin.ee/13plZEe')"
      class="btn-redirect oa"
    >
      回到官方帳號
    </button>
  </div>
</template>
<script>
const urlParams = new URLSearchParams(window.location.search);
export default {
  urlParams,
  data: () => ({
    work: {
      debug: false,
      loading: false,
      message: [],
    },
    basic: {
      baseUrl: "https://www.raceon.com.tw",
      pageHandle: "liff",
      customer: "",
      email: "",
      redirect: "",
      forceFriend: "",
      cta_btn: "",
      cta_external: false,
      utms: {},
      action: {},
    },
    liff_data: {
      appId: 1653395526,
      liffId: "1653395526-BYyn1YAl",
      api_loading: true,
      initialized: false,
      loggedIn: false,
      inClient: false,
      isFriend: false,
      os: "",
      language: "",
      liff_version: "",
      line_version: "",
      user: {
        name: "",
        pictureUrl: "",
        IDToken: "",
        uid: "",
      },
    },
  }),
  methods: {
    initializeLiff: async function () {
      this.liff_data.api_loading = true;
      this.work.loading = true;
      try {
        await liff.init({
          liffId: this.liff_data.liffId, // Use own liffId
          //withLoginOnExternalBrowser: true, // Enable automatic login process
        });

        await this.storeAction();
        //check cyb member
        const member = await axios.get(`/account/check_login.json?${new Date().getTime()}`);
        this.basic.customer = member?.data.id || null;
        this.basic.email = member?.data.email || null;

        this.liff_data.inClient = liff.isInClient();
        this.liff_data.os = liff.getOS();
        this.liff_data.language = liff.getLanguage();
        this.liff_data.liff_version = liff.getVersion();
        this.liff_data.line_version = liff.getLineVersion();
        this.liff_data.loggedIn = liff.isLoggedIn();
        this.liff_data.user.IDToken = liff.getIDToken(); //寫入 Line ID Token
        this.liff_data.api_loading = false;
        this.basic.redirect = store.get("_liff")?.action || "collections/raceon-products";
        this.basic.forceFriend = store.get("_liff")?.friend || false;
        this.basic.utms = store.get("_liff_utm") || {};
        this.basic.action = store.get("_liff") || {};

        this.work.debug = store.get("_liff")?.debug || false;

        if (this.liff_data.loggedIn) {
          const getFriendship = await liff.getFriendship();
          this.liff_data.isFriend = getFriendship.friendFlag || false;
        }

        this.liff_data.initialized = true;
        this.work.message.push("Liff初始化完畢。");

        return this.initApp();

      } catch (err) {
        console.log("LIFF initialization failed", err);
        this.liff_data.api_loading = false;
        this.work.loading = false;
        alert("發生錯誤，請重試。");
        return window.close();
      }
    },
    liffLogin: function () {
      this.work.loading = true;
      this.work.message.push("執行 liffLogin()");

      //檢查是否有跳轉紀錄，否則將參數加回去跳回Liff
      if (!store.get("_liff")?.action) {
        return this.redirect("", this.basic.action, true);
      }

      //檢查Liff登入
      if (!this.liff_data.loggedIn) {
        return liff.login({ redirectUri: location.href });
      }

      //檢查EC登入
      if (!this.basic.customer) {
        this.work.message.push("CYB未登入");
        let link = this.basic.baseUrl + "/pages/" + this.basic.pageHandle + "?id_token=" + this.liff_data.user.IDToken;
        return this.redirect("account/login", {redirect_url : link}, false, false, true, 'liff');
      }

      //檢查是否為好友
      if (!this.liff_data.isFriend && this.basic.forceFriend) {
        alert("請先加入或解除封鎖好友，才可以繼續唷 :)");
        return this.redirect("R/ti/p/@raceon", {}, true);
      }
      //跳回官網
      return this.redirectShop();
    },
    reboot: function () {
      this.work.message.push(`執行Reboot`);
      if (liff.isLoggedIn()) {
        this.work.message.push(`執行liff.logout()`);
        liff.logout();
        this.liff_data.loggedIn = false;
      }
      let self = this;
      return axios.get("/account/logout").then(function (response) {
        self.work.message.push(`執行登出cyb`);
        self.redirect("", self.basic.action, true);
      });
    },
    bindLiff: function () {
      this.work.message.push("開始綁定liff");
      let self = this;
      const headers = {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "*/*",
        },
      };
      axios
        .post(
          "https://s.raceon.com.tw/component/survey/liff",
          {
            uid: self.basic.customer,
            email: self.basic.email,
            token: self.liff_data.user.IDToken,
          },
          headers
        )
        .then(function (response) {
          console.log(response);
          self.work.message.push("綁定成功");
          return self.redirectShop();
        })
        .catch(function (error) {
          self.work.message.push("綁定失敗 " + error.response?.data);
          if (error.response?.data?.code == 410) {
            //已綁定過，執行登入
            return self.redirect("", self.basic.action, true);
          } else if (error.response?.data?.code == 407) {
            alert("此帳號已與其他LINE帳號綁定，綁定失敗。");
            return window.close();
          } else {
            //回到liff 重新登入
            return self.redirect("", { action: "relogin" }, true);
          }
        });
    },
    unbindLiff: function () {
      let self = this;
      const optionAxios = {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "*/*",
        },
      };
      return axios
        .post(
          "https://s.raceon.com.tw/component/survey/liff?action=unbind",
          {
            uid: self.basic.customer,
            email: self.basic.email,
          },
          optionAxios
        )
        .then(function (response) {
          console.log(response);
          self.work.message.push("解綁成功，執行reboot");
          store.remove("_liff_utm");
          store.remove("_liff");
          self.reboot();
        })
        .catch(function (error) {
          alert(error.response.data);
        });
    },
    redirectShop: function () {
      return (this.liff_data.line_version !== null || this.liff_data.os == "web") ? 
      (store.remove("_liff"), this.redirect(this.basic.redirect, {}, false, true)) :
      this.redirect("", { action: "relogin" }, true);
    },
    initApp: function () {
      //action作業
      if (urlParams.has("action")) { 
        //檢查是否在liff
        const debug = this.work.debug ? document.body.style.overflow = "auto" : '';
        if (!this.liff_data.inClient) {
          //如果是在網頁版就直接跳到目標頁面
          if (this.liff_data.line_version !== null || this.liff_data.os == "web") {
            return this.redirectShop();
          }
          //如果是手機版跳回line
            return this.redirect( "", this.basic.action, true, true);
        }
        //重新登入
        if (urlParams.get("action") == "relogin") {
          return this.reboot();
        }
        //嘗試使用line action登入
        this.work.message.push(`嘗試登入`);
        return this.redirect("customer/auth/line", { line_action: "pages/"+this.basic.pageHandle });

        //綁定作業
      } else if (urlParams.has("id_token")) { 
        this.liff_data.user.IDToken = urlParams.get("id_token");
        //把url id_token 刪除，以防二次作業
        window.history.replaceState(null, null, window.location.pathname);
        return this.bindLiff();
      } else {
        //若沒有任何params，表示從嘗試登入跳回來，執行下一步
        return this.liffLogin();
      }
    },
    redirect: function (path, params, goLiff, utms = false, external = false, hash) {
      const rliff = goLiff || false;
      //URL頁面，看要前往網站或是line
      const rURL = rliff ? `https://line.me` : this.basic.baseUrl;
      //如果是要前往line://但path沒有填，就表示要前往liff，反之要前往官方帳號或其他line頁面
      const rPath =
        rliff && !path ? `R/app/${this.liff_data.liffId}` : path || "pages/"+this.basic.pageHandle;
      let rParams = params || {};
      //如果是跳回line，就必須把utm參數帶回來
      const rUtms = rliff
        ? { utms: encodeURIComponent(JSON.stringify(this.basic.utms)) }
        : this.basic.utms;
      //跳出liff
      this.basic.cta_external = external || false;
      //加入hash for login
      const rHash = hash ? '#'+hash : '';

      if (utms) {
        //把UTM加回去
        rParams = Object.assign(rParams, rUtms);
        store.remove("_liff_utm");
      }

      const redirectURL = new URL(rURL);
      let searchParams = new URLSearchParams(rParams);

      redirectURL.pathname = `/${rPath}`;
      redirectURL.search = searchParams;
      this.basic.cta_btn = redirectURL.href + rHash;
      this.work.loading = false;

      this.work.message.push(`跳轉頁面`);
      if (this.work.debug) {
        if (!confirm("redirect to line:" + this.basic.cta_btn)) { return }
      } 
      return  external ? liff.openWindow({ url: this.basic.cta_btn }) : window.location.replace(this.basic.cta_btn)

    },
    storeAction: function () {
       return new Promise(resolve => {

          //儲存UTMs
          if (urlParams.has("utms")) {
          let utms = JSON.parse(decodeURIComponent(urlParams.get("utms")));
          store.set("_liff_utm", utms);
          }
          //將要跳轉的頁面存起來
          if (
            urlParams.has("action") &&
            urlParams.get("action") !== "back" &&
            urlParams.get("action") !== "relogin"
          ) {
            this.work.message.push(`儲存${urlParams.get("action")}`);
            let ufriend =
              urlParams.has("friend") && urlParams.get("friend") == "true"
                ? true
                : false;
            let udebug =
              (urlParams.has("debug") && urlParams.get("debug") == "true") || this.work.debug
                ? true
                : false;
           store.set("_liff", {
              action: urlParams.get("action"),
              friend: ufriend,
              debug: udebug,
            });

            resolve();
          }

         }); 
    },
    openLink: function (url, external = false) {
     return external ? liff.openWindow({ url: url }) : window.location.replace(url)
    },
  },

  mounted: function () {
    this.initializeLiff();
  },
  beforeMount: function() {
    //從Liquid寫入參數
    if (typeof line !== 'undefined') {  
    this.basic.baseUrl     = line?.baseUrl || this.basic.baseUrl;
    this.basic.pageHandle  = line?.pageHandle || this.basic.pageHandle;
    this.liff_data.appId   = line?.appId || this.liff_data.appId;
    this.liff_data.liffId  = line?.liffId || this.liff_data.liffId;
    this.work.debug        = line?.debug || this.work.debug;
    }
  }  
};
</script>   


<style>
</style>
