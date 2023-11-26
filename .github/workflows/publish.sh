mkdir -p dist
cd dist

curl -L \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/$GITHUB_REPO/releases?per_page=100" \
  -o releases.json

HASH=$(md5sum releases.json | cut -d ' ' -f 1)
echo '{"name":"@koishijs/releases","main":"releases.json"}' | jq ".version=\"0.0.0-$HASH\"" > package.json
cat package.json

npm publish --access public --tag latest
