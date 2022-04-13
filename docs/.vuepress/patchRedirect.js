const target = require('@vuepress/core/lib/app/prepare/preparePagesRoutes');
const shared = require("@vuepress/shared");

target.preparePagesRoutes = async (app) => {
  const content = `\
import { Vuepress } from '@vuepress/client/lib/components/Vuepress'

const routeItems = [\
${app.pages
      .map(({ key, path, pathInferred, filePathRelative, routeMeta, frontmatter }) => {
      const redirects = [];
      const routeItem = [key, path, routeMeta, redirects];
      // paths that should redirect to this page
      const redirectsSet = new Set();
      // redirect from decoded path
      addPath(path);
      function addPath(path) {
          redirectsSet.add(decodeURI(path));
          if (path.endsWith('/')) {
              // redirect from index path
              redirectsSet.add(path + 'index.html');
          }
          else {
              // redirect from the path that does not end with `.html`
              redirectsSet.add(path.replace(/.html$/, ''));
          }
      }
      // redirect from inferred path
      if (pathInferred !== null) {
          redirectsSet.add(pathInferred);
          redirectsSet.add(encodeURI(pathInferred));
      }
      // redirect from filename path
      if (filePathRelative !== null) {
          const filenamePath = shared.ensureLeadingSlash(filePathRelative);
          redirectsSet.add(filenamePath);
          redirectsSet.add(encodeURI(filenamePath));
      }
      if (frontmatter.redirectFrom) {
          for (const path of frontmatter.redirectFrom) {
            addPath(path);
          }
      }
      // avoid redirect from the page path itself
      redirectsSet.delete(path);
      // add redirects to route item
      redirects.push(...redirectsSet);
      return `\n  ${JSON.stringify(routeItem)},`;
  })
      .join('')}
]

export const pagesRoutes = routeItems.reduce(
(result, [name, path, meta, redirects]) => {
  result.push(
    {
      name,
      path,
      component: Vuepress,
      meta,
    },
    ...redirects.map((item) => ({
      path: item,
      redirect: path,
    }))
  )
  return result
},
[
  {
    name: "404",
    path: "/:catchAll(.*)",
    component: Vuepress,
  }
]
)
`;
  await app.writeTemp('internal/pagesRoutes.js', content);
};
