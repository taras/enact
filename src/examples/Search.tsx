import {
  each,
  spawn,
  sleep,
  useAbortSignal,
  call,
  Task,
} from "effection";
import { enact, $, useValue, Value } from "../enact.tsx";
import { ChangeEventHandler } from "react";

// Define interfaces for the npm search results
interface NpmPackage {
  name: string;
  version: string;
  description: string;
  links: {
    npm: string;
  };
}

interface NpmSearchResult {
  package: NpmPackage;
}

interface NpmSearchResponse {
  results: NpmSearchResult[];
}

export const Search = enact<{ query?: string | undefined }>(function* (props) {
  const query = useValue(props.query);

  const onChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    query.set((event.target as HTMLInputElement).value);
  };

  return (
    <div>
      <input value={query.current} onChange={onChange} />
      <SearchResults query={query} />
    </div>
  );
});

const SearchResults = enact<{ query: Value<string | undefined> }>(function* (props) {
  let lastTask: Task<void> | undefined;

  for (const q of yield* each(props.query)) {
    if (!q?.length) {
      yield* $(<p>Enter a keyword to search for packages on NPM.</p>); // Renders an "Initial State"
      yield* each.next();
      continue; // skip everything else below.
    }

    if (lastTask) {
      yield* lastTask.halt();
    }

    lastTask = yield* spawn(function* () {
      yield* $(<p>Loading results for {q}...</p>);
      // Attempting to add debouncing for when things go out of scope below but didn't seem to work :thinking:

      yield* sleep(300);

      try {
        let { results } = yield* npmSearch(q);
        yield* $(<SearchResultsList results={results} />);
      } catch (error) {
        yield* $(<ErrorMessage error={error instanceof Error ? error : new Error(String(error))} />);
      }
    });

    yield* each.next();
  }
});

function SearchResultsList({ results }: { results: NpmSearchResult[] }) {
  return results.length === 0 ? (
    <p>No results</p>
  ) : (
    <ul>
      {results.map((result) => (
        <li key={result.package.name}>
          <h3 className="package-name">
            <a href={result.package.links.npm} target="_blank">
              {result.package.name}
            </a>{" "}
            <small className="package-version">
              ({result.package.version})
            </small>
          </h3>
          <p className="package-description">{result.package.description}</p>
        </li>
      ))}
    </ul>
  );
}

function* npmSearch(query: string) {
  const signal = yield* useAbortSignal();
  /* npms.io search API is used in this example. Good stuff.*/
  const url = `https://api.npms.io/v2/search?from=0&size=25&q=${query}`;
  let response = yield* call(() => fetch(url, { signal }));

  if (response.ok) {
    const data = yield* call(() => response.json());
    return data as NpmSearchResponse;
  }

  /* If API returns some weird stuff and not 2xx, convert it to error and show
     on the screen. */
  throw new Error(yield* call(() => response.text()));
}

function ErrorMessage({ error }: { error: Error }) {
  return (
    <details>
      <summary>Something went wrong!</summary>
      <p>{error.message}</p>
    </details>
  );
}
