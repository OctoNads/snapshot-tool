import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

const App = () => {
  const [contractAddress, setContractAddress] = useState("");
  const [minNFTs, setMinNFTs] = useState("");
  const [holderCount, setHolderCount] = useState("");
  const [result, setResult] = useState([]);
  const [collectionMetadata, setCollectionMetadata] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessInput, setAccessInput] = useState("");
  const [accessError, setAccessError] = useState(false);
  const [floatingTextStyles, setFloatingTextStyles] = useState([]);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [fileFormat, setFileFormat] = useState("pdf");
  const [fetchError, setFetchError] = useState("");

  // Request notification permission on component mount
  useEffect(() => {
    if (
      "Notification" in window &&
      Notification.permission !== "granted" &&
      Notification.permission !== "denied"
    ) {
      Notification.requestPermission().catch((err) =>
        console.error("Notification permission error:", err)
      );
    }
  }, []);

  // Set up floating text animation
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
      }));
      setFloatingTextStyles(newStyles);
    };

    moveFloatingTexts();
    const interval = setInterval(moveFloatingTexts, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle access code submission
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

  // Retry fetch function with exponential backoff
  const retryFetch = async (fn, initialDelay = 1000) => {
    let delay = initialDelay;
    const retry = async () => {
      try {
        return await fn();
      } catch (error) {
        console.log(`Retrying in ${delay}ms... Error: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        if (delay > 16000) delay = 16000; // Cap delay at 16 seconds
        return retry(); // Recursively retry
      }
    };
    return retry();
  };

  // Fetch NFT holders for a single page
  const fetchNFTHolders = async (contractAddress, pageIndex = 1, pageSize = 10) => {
    const url = `/api/holders?contractAddress=${encodeURIComponent(
      contractAddress
    )}&pageIndex=${pageIndex}&pageSize=${pageSize}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
  };

  // Fetch all NFT holders with pagination and retries
  const fetchAllNFTHolders = async (contractAddress, pageSize = 10) => {
    let allHolders = [];
    let metadata = null;
    let pageIndex = 1;
    const batchSize = 5; // Fetch 10 pages at a time
    let total = 0; // Total number of holders, set dynamically from API

    while (true) {
      const fetchPromises = [];
      // Create promises for the current batch
      for (let i = 0; i < batchSize && pageIndex + i <= 1000; i++) {
        const currentPage = pageIndex + i;
        fetchPromises.push(
          retryFetch(() => fetchNFTHolders(contractAddress, currentPage, pageSize))
        );
      }

      // Wait for all promises in the batch to resolve
      const batchResults = await Promise.all(fetchPromises);

      // Process each result in the batch
      for (const result of batchResults) {
        if (!metadata && result.metadata) metadata = result.metadata;
        if (total === 0 && result.total) total = result.total; // Set total from first response
        allHolders.push(...result.holders);
        if (allHolders.length < total) {
          // Continue fetching if more holders are expected
        } else {
          break; // Stop if all holders are fetched
        }
      }

      pageIndex += batchSize;
      console.log(`Fetched ${allHolders.length} holders so far`);

      // Stop if we've fetched all holders or no more pages are available
      if (allHolders.length >= total || fetchPromises.length < batchSize) break;

      // Add delay between batches to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1-second delay
    }

    // Log warning if fewer holders were fetched than expected
    if (allHolders.length < total) {
      console.warn(`Only fetched ${allHolders.length} holders, expected ${total}`);
    }

    return { holders: allHolders, metadata };
  };

  // Filter holders by minimum NFT count
  const filterHolders = (holders, minNFTs) => {
    return holders.filter((holder) => Number(holder.amount) > minNFTs);
  };

  // Handle form submission
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      setHolderCount("");
      setResult([]);
      setCollectionMetadata(null);
      setFetchError("Invalid contract address format.");
      return;
    }

    let minNFTsValue = 0;
    if (minNFTs) {
      minNFTsValue = parseInt(minNFTs, 10) - 1;
      if (isNaN(minNFTsValue) || minNFTsValue < 0) {
        alert("Please enter a valid minimum NFT count (positive integer).");
        return;
      }
    }

    setIsLoading(true);
    setShowInfoPopup(true);
    setFetchError("");
    setHolderCount("");
    setResult([]);
    setCollectionMetadata(null);

    // Hide info popup after 5 seconds
    setTimeout(() => setShowInfoPopup(false), 5000);

    try {
      const { holders, metadata } = await fetchAllNFTHolders(contractAddress);
      if (holders.length > 0) {
        const filteredHolders = filterHolders(holders, minNFTsValue);
        setHolderCount(
          `Number of Holders holding at least ${minNFTs || 1} NFT(s): ${
            filteredHolders.length
          }`
        );
        setResult(filteredHolders);
        setCollectionMetadata(metadata);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Fetching Completed", {
            body: "NFT holders have been successfully fetched!",
          });
        }
        setShowCompletion(true);
      } else {
        setHolderCount("Number of holders: 0");
        setResult([]);
        setCollectionMetadata(null);
        setShowCompletion(true);
      }
    } catch (error) {
      setFetchError(`Failed to fetch holders: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form fields
  const handleReset = () => {
    setContractAddress("");
    setMinNFTs("");
    setHolderCount("");
    setResult([]);
    setCollectionMetadata(null);
    setFetchError("");
  };

  // Handle download of holder addresses
  const handleDownload = () => {
    const addresses = result.map((holder) => holder.ownerAddress).filter((addr) => addr);
    if (addresses.length === 0) {
      alert("No holders to download.");
      return;
    }

    if (fileFormat === "pdf") {
      const doc = new jsPDF();
      const lineHeight = 10;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 10;
      let y = margin;

      addresses.forEach((addr) => {
        if (y + lineHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(addr, margin, y);
        y += lineHeight;
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
          {fetchError && <div className="error-message">{fetchError}</div>}
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
              {isLoading ? "Loading..." : fetchError ? "Try Again" : "Find Holders"}
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
            {isLoading ? (
              <div className="spinner"></div>
            ) : result.length > 0 ? (
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
        </div>

        {/* Floating texts */}
        {floatingTextStyles.map((style, index) => (
          <div
            key={index}
            className="floating-text"
            style={{ ...style, MozTransition: style.transition, WebkitTransition: style.transition }}
          >
            {["GMONAD", "GOCTO", "GCHOG", "GCHOGSTAR", "GMOO", "GDAKS", "G10K", "GBLOCK", "GMEOW", "GMOPO", "GCANZ"][index]}
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

      {/* Info Popup Modal (Shown for 5 seconds when fetching starts) */}
      {showInfoPopup && (
        <div className="modal" id="infoModal">
          <div className="modal-content">
            <h2>Fetching in Progress</h2>
            <p>The Result will Display in some mins. Please sit back Relax we will notify you.</p>
            <p>In case of Any Failure Try again.</p>
            <button onClick={() => setShowInfoPopup(false)}>Close</button>
          </div>
        </div>
      )}

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

export default App;