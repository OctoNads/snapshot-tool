import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

const App = () => {
  const [contractAddress, setContractAddress] = useState("");
  const [minNFTs, setMinNFTs] = useState("");
  const [holderCount, setHolderCount] = useState("");
  const [result, setResult] = useState([]); // Store all fetched holders
  const [collectionMetadata, setCollectionMetadata] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessInput, setAccessInput] = useState("");
  const [accessError, setAccessError] = useState(false);
  const [floatingTextStyles, setFloatingTextStyles] = useState([]);
  const [showCompletion, setShowCompletion] = useState(false);
  const [fileFormat, setFileFormat] = useState("pdf");
  const [fetchError, setFetchError] = useState("");
  const [currentPageIndex, setCurrentPageIndex] = useState(1); // Track current page for pagination
  const [hasMorePages, setHasMorePages] = useState(true); // Track if more data is available

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission().catch((err) => console.error("Notification permission error:", err));
    }
  }, []);

  // Floating text animation
  useEffect(() => {
    const floatingTexts = [
      "GMONAD",
      "GOCTO",
      "GCHOG",
      "GCHOGSTAR",
      "GMOO",
      "GDAKS",
      "G10K",
      "GBLOCK",
      "GMEOW",
      "GMOPO",
      "GCANZ",
    ];

    const initialStyles = floatingTexts.map(() => ({}));
    setFloatingTextStyles(initialStyles);

    const moveFloatingTexts = () => {
      const maxX = window.innerWidth - 100;
      const maxY = window.innerHeight - 50;
      const newStyles = floatingTexts.map(() => ({
        left: `${Math.random() * maxX}px`,
        top: `${Math.random() * maxY}px`,
        transition: "all 5s linear",
        WebkitTransition: "all 5s linear", // Safari compatibility
        MozTransition: "all 5s linear",    // Firefox compatibility
      }));
      setFloatingTextStyles(newStyles);
    };

    moveFloatingTexts();
    const interval = setInterval(moveFloatingTexts, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle access submission
  const handleAccessSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const input = accessInput.trim().toUpperCase();
    if (input === "GOCTO") {
      setAccessGranted(true);
      setAccessError(false);
    } else {
      setAccessError(true);
    }
  };

  // Fetch NFT holders from backend
  const fetchNFTHolders = async (contractAddress, pageIndex = 1, pageSize = 10) => {
    const url = `/api/holders?contractAddress=${encodeURIComponent(contractAddress)}&pageIndex=${pageIndex}&pageSize=${pageSize}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }
    return response.json();
  };

  // Fetch all holders with pagination and retry logic
  const fetchAllNFTHolders = async (startOver = false) => {
    if (!hasMorePages && !fetchError) return; // Stop if no more pages and no error to retry

    setIsLoading(true);
    setFetchError(""); // Clear previous errors if starting over

    const pageSize = 10;
    const batchSize = 5;
    let allHolders = startOver ? [] : [...result]; // Preserve existing holders unless starting over
    let metadata = collectionMetadata;
    let pageIndex = startOver ? 1 : currentPageIndex;

    try {
      const fetchPromises = [];
      for (let i = 0; i < batchSize && pageIndex + i <= 1000; i++) {
        fetchPromises.push(fetchNFTHolders(contractAddress, pageIndex + i, pageSize));
      }
      const batchResults = await Promise.all(fetchPromises);

      let hasMore = false;
      for (const result of batchResults) {
        if (!metadata) metadata = result.metadata;
        allHolders.push(...result.holders);
        if (result.holders.length === pageSize) hasMore = true; // More pages if full batch received
      }

      const minNFTsValue = parseInt(minNFTs, 10) - 1 || 0;
      const filteredHolders = filterHolders(allHolders, minNFTsValue);

      setResult(filteredHolders);
      setHolderCount(`Number of Holders holding at least ${minNFTs || 1} NFT(s): ${filteredHolders.length}`);
      setCollectionMetadata(metadata);
      setCurrentPageIndex(pageIndex + batchSize);
      setHasMorePages(hasMore);

      if (!hasMore) {
        setShowCompletion(true);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Fetching Completed", {
            body: "All NFT holders have been successfully fetched!",
          });
        }
      }
    } catch (error) {
      setFetchError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter holders by minimum NFT count
  const filterHolders = (holders, minNFTs) => {
    return holders.filter((holder) => Number(holder.amount) > minNFTs);
  };

  // Form submission (start fetching from scratch)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      setHolderCount("");
      setResult([]);
      setCollectionMetadata(null);
      setFetchError("Invalid contract address format.");
      return;
    }

    let minNFTsValue = parseInt(minNFTs, 10) - 1;
    if (minNFTs && (isNaN(minNFTsValue) || minNFTsValue < 0)) {
      alert("Please enter a valid minimum NFT count (positive integer).");
      return;
    }

    setHolderCount("");
    setResult([]);
    setCollectionMetadata(null);
    setCurrentPageIndex(1);
    setHasMorePages(true);
    fetchAllNFTHolders(true); // Start over
  };

  // Retry fetching from current page
  const handleRetry = () => {
    fetchAllNFTHolders(false); // Continue from current page
  };

  // Reset form
  const handleReset = () => {
    setContractAddress("");
    setMinNFTs("");
    setHolderCount("");
    setResult([]);
    setCollectionMetadata(null);
    setFetchError("");
    setCurrentPageIndex(1);
    setHasMorePages(true);
  };

  // Download results
  const handleDownload = () => {
    const addresses = result.map((holder) => holder.ownerAddress).filter((addr) => addr);
    if (addresses.length === 0) {
      alert("No holders to download.");
      return;
    }

    if (fileFormat === "pdf") {
      const doc = new jsPDF();
      addresses.forEach((addr, index) => {
        doc.text(addr, 10, 10 + index * 10);
      });
      doc.save("holders.pdf");
    } else if (fileFormat === "xml") {
      const xmlContent = `<holders>\n${addresses
        .map((addr) => `    <address>${addr}</address>`)
        .join("\n")}\n</holders>`;
      const blob = new Blob([xmlContent], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "holders.xml";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
      <div className={accessGranted ? "" : "blur-content"}>
        <header className="sticky-header">
          <img
            src="https://amethyst-worthy-gayal-734.mypinata.cloud/ipfs/bafkreiguhll5qwfac6x36v362nv2mhgl7so45dd262zpulwq7c4tfwbedq"
            alt="OctoNads Logo"
            className="header-logo"
          />
          <div className="header-title">
            <h1>SNAPSHOT TOOL</h1>
            <h2 className="subheading">(Monad Testnet)</h2>
          </div>
          <div className="header-spacer"></div>
        </header>
        <div className="container">
          {fetchError && (
            <div className="error-message">
              {fetchError}
              <br />
              {result.length > 0 && (
                <button onClick={handleRetry} disabled={isLoading}>
                  Retry Fetching More
                </button>
              )}
            </div>
          )}
          <form onSubmit={handleFormSubmit}>
            <label htmlFor="contractAddress">NFT Contract Address:</label>
            <input
              type="text"
              id="contractAddress"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder="e.g., 0x..."
              required
              aria-required="true"
            />
            <label htmlFor="minNFTs">Minimum NFTs (optional, default is 1):</label>
            <input
              type="number"
              id="minNFTs"
              value={minNFTs}
              onChange={(e) => setMinNFTs(e.target.value)}
              min="1"
              placeholder="Enter minimum NFT count"
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Loading..." : fetchError && result.length === 0 ? "Try Again" : "Find Holders"}
            </button>
            <button type="button" onClick={handleReset} disabled={isLoading}>
              Reset
            </button>
          </form>

          {collectionMetadata && (
            <div className="metadata-section">
              <h2 className="metadata-heading">Collection Details</h2>
              <div className="metadata-content">
                <div className="text-info">
                  <h3>
                    {collectionMetadata.name}
                    {collectionMetadata.verified && (
                      <img
                        src="https://amethyst-worthy-gayal-734.mypinata.cloud/ipfs/bafkreid7pkljli36nzivwmixmdul5pa44qhpcpxgrxukmkawuc3j2shb3e"
                        alt="Verified Badge"
                        className="verified-badge"
                      />
                    )}
                  </h3>
                  <p>Supply: {collectionMetadata.supply}</p>
                  {collectionMetadata.marketplaceLink && (
                    <a
                      href={collectionMetadata.marketplaceLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="marketplace-link"
                    >
                      View on Marketplace
                    </a>
                  )}
                </div>
                <div className="image-and-logos">
                  <img
                    src={collectionMetadata.image}
                    alt={`${collectionMetadata.name} collection`}
                    className="collection-image"
                  />
                  <div className="social-logos">
                    {collectionMetadata.twitter && (
                      <a href={collectionMetadata.twitter} target="_blank" rel="noopener noreferrer">
                        <i className="fab fa-twitter social-logo" aria-label="Twitter"></i>
                      </a>
                    )}
                    {collectionMetadata.discord && (
                      <a href={collectionMetadata.discord} target="_blank" rel="noopener noreferrer">
                        <i className="fab fa-discord social-logo" aria-label="Discord"></i>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {!collectionMetadata && holderCount && (
            <p className="metadata-unavailable">
              Collection metadata not available for this contract address. Contact the OctoNads Team to get it uploaded.
            </p>
          )}

          {holderCount && <div id="holderCount">{holderCount}</div>}
          <div id="result">
            {result.length > 0 ? (
              Array.isArray(result) && result[0].ownerAddress ? (
                <ul>
                  {result.map((holder, index) => (
                    <li key={index}>
                      {holder.ownerAddress} - Amount: {holder.amount}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{result[0]}</p>
              )
            ) : (
              <p>Holders will appear here...</p>
            )}
          </div>

          <div id="downloadOptions">
            <label htmlFor="fileFormat">Download as:</label>
            <select
              id="fileFormat"
              value={fileFormat}
              onChange={(e) => setFileFormat(e.target.value)}
            >
              <option value="pdf">PDF</option>
              <option value="xml">XML</option>
            </select>
            <button onClick={handleDownload} disabled={!result.length || isLoading}>
              Download
            </button>
          </div>

          {/* Load More button if there are more pages and no error */}
          {result.length > 0 && hasMorePages && !fetchError && (
            <button onClick={() => fetchAllNFTHolders(false)} disabled={isLoading}>
              {isLoading ? "Loading..." : "Load More Holders"}
            </button>
          )}
        </div>

        {/* Floating texts */}
        {floatingTextStyles.map((style, index) => (
          <div
            key={index}
            className="floating-text"
            style={{ ...style, MozTransition: style.transition, WebkitTransition: style.transition }}
          >
            {floatingTexts[index]}
          </div>
        ))}

        <footer>
          <div className="copyright">© 2025</div>
          <div className="powered-by">Powered by OctoNads</div>
          <div className="social-icons">
            <a href="https://x.com/OctoNads" target="_blank" rel="noopener noreferrer">
              <i className="fab fa-twitter social-logo" aria-label="Twitter"></i>
            </a>
            <a href="https://discord.com/invite/octonads" target="_blank" rel="noopener noreferrer">
              <i className="fab fa-discord social-logo" aria-label="Discord"></i>
            </a>
          </div>
        </footer>
      </div>

      {/* Access Modal */}
      <div className="modal" style={{ display: accessGranted ? "none" : "block" }} id="accessModal">
        <div className="modal-content">
          <h2>Access Required</h2>
          <p>Please type "GOCTO" to access the snapshot tool.</p>
          <form onSubmit={handleAccessSubmit}>
            <input
              type="text"
              id="accessInput"
              value={accessInput}
              onChange={(e) => setAccessInput(e.target.value)}
              placeholder="Type GOCTO"
              autoFocus
              required
              aria-required="true"
            />
            <button type="submit">Submit</button>
          </form>
          {accessError && (
            <p id="accessError" className="error-message">
              Incorrect input. Please try again.
            </p>
          )}
        </div>
      </div>

      {/* Completion Modal */}
      {showCompletion && (
        <div className="modal" id="completionModal">
          <div className="modal-content">
            <h2>Fetching Completed</h2>
            <p>NFT holders have been successfully fetched!</p>
            <button onClick={() => setShowCompletion(false)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
};

const floatingTexts = [
  "GMONAD",
  "GOCTO",
  "GCHOG",
  "GCHOGSTAR",
  "GMOO",
  "GDAKS",
  "G10K",
  "GBLOCK",
  "GMEOW",
  "GMOPO",
  "GCANZ",
];

export default App;