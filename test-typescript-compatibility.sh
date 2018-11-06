#!/usr/bin/env bash
set -euo pipefail

version="${1:?Must supply a valid TS version}"
package_path="$(pwd)"
temp_dir="${package_path}/temp"
temp_file="${temp_dir}/test.ts"
rm -rf "${temp_dir}"
mkdir "${temp_dir}"

function run_tsc() {
    "$(yarn bin)/tsc" $@
}

rm -rf ./dist && \
echo "Installing typescript version: ${version}" && \
yarn --silent add -D "typescript/@${version}" && \
run_tsc --noEmitOnError && \
echo "Writing test file to: ${temp_file}" && \
echo 'import * as hWs from "../dist";' > "${temp_file}" && \
cd "${temp_dir}" && \
echo "Starting compilatin of dummy project in $(pwd)" && \
run_tsc --init && \
run_tsc --noEmitOnError

node "test.js"
exit="${?}"

echo "Node exit code was: ${exit}"

if [[ "${exit}" != 0 ]]; then 
    echo "Compilation failed for version ${version}"; exit 100;
else
    echo "Compilation succeeded for version: ${version}"
fi