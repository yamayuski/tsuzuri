import { useSignal } from "@preact/signals";
import { Head } from "fresh/runtime";
import Monaco from "../islands/Monaco.tsx";
import Navbar from "../islands/Navbar.tsx";
import SideMenu from "../islands/SideMenu.tsx";
import { define } from "../utils.ts";

export default define.page(function Home(ctx) {
  const source = useSignal(`# Tsuzuri へようこそ！

これは Monaco Editor を使用したシンプルなマークダウンエディタです。
`);

  console.log("Shared value " + ctx.state.shared);

  return (
    <div class="min-h-screen drawer lg:drawer-open">
      <Head>
        <title>Tsuzuri</title>
      </Head>
      <input id="my-drawer" type="checkbox" class="drawer-toggle" />
      <div class="drawer-content fresh-gradient flex flex-col items-center justify-start">
        <Navbar />
        <Monaco source={source} />
      </div>
      <div class="drawer-side">
        <label
          for="my-drawer"
          aria-label="close sidebar"
          class="drawer-overlay"
        >
        </label>
        <SideMenu />
      </div>
    </div>
  );
});
