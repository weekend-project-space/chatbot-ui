import { DocumentProps, Head, Html, Main, NextScript } from 'next/document';

import i18nextConfig from '../next-i18next.config';

type Props = DocumentProps & {
  // add custom document props
};

function createStatistics() {
 return {__html: `var _hmt = _hmt || [];
 (function() {
   var hm = document.createElement("script");
   hm.src = "https://hm.baidu.com/hm.js?8ba1ec790bd7fe9df8ef26b46ab5a2d0";
   var s = document.getElementsByTagName("script")[0]; 
   s.parentNode.insertBefore(hm, s);
 })();`};
}

export default function Document(props: Props) {
  const currentLocale =
    props.__NEXT_DATA__.locale ?? i18nextConfig.i18n.defaultLocale;
  return (
    <Html lang={currentLocale}>
      <Head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="chat gpt 在线体验"></meta>
        <script dangerouslySetInnerHTML={createStatistics()}>
        </script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
