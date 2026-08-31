<img src="src/img/lab.png" alt="Song Lab" width="120" align="right">

# HantaCon

![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS-brightgreen)
![Version](https://img.shields.io/badge/version-v2.1-blue)

**HantaCon** is an integrated desktop application for genomic surveillance and phylogeographic visualization of **Hantaan virus (HTNV)**.

HantaCon combines automated consensus genome generation from Oxford Nanopore sequencing reads, a curated geographically annotated Korean HTNV reference database, and localized Nextstrain visualization within a graphical desktop environment.

> **v2.1 is the first public release.** Earlier versions were internal prototypes and are not distributed.

<img src="src/img/screenshots/1.png" alt="HantaCon Auspice visualization" width="820">

## Overview

**From reads to consensus genomes.**  
HantaCon generates L-, M-, and S-segment consensus sequences from Oxford Nanopore sequencing reads using the KU-ONT-HTNV-consensus workflow. Reads are aligned to the tripartite genome of HTNV strain 76-118 (GenBank NC_005222, NC_005219, and NC_005218 for the L, M, and S segments), and consensus sequences are called with user-adjustable thresholds.

**From genomes to geographic context.**  
Newly generated HTNV sequences can be analyzed together with a curated Korean reference database containing geographic, temporal, host, and lineage metadata. Specimen metadata are entered through the interface, so no external metadata file needs to be prepared.

**Interactive phylogeographic visualization.**  
Segment-specific phylogenetic analyses are performed using a localized Nextstrain workflow and visualized interactively with Auspice, including a phylogenetic tree, a geographic map, and a genome-wide nucleotide diversity panel.

**A desktop workflow.**  
HantaCon integrates an Electron-based graphical user interface with a Docker-containerized bioinformatics backend, reducing the need to operate individual command-line tools.

Prepared HTNV FASTA sequences can also be analyzed directly, bypassing the consensus-generation step.

## System requirements

HantaCon is currently supported on:

- Ubuntu Linux
- macOS

Docker is required to run the containerized bioinformatics environment. All bioinformatics dependencies are pre-installed in the container and do not require separate installation.

Runtime reference: for the datasets described in the associated study, analysis of the L, M, and S segments, from prepared FASTQ reads through consensus generation to localized Nextstrain visualization, completed within approximately 15 minutes on a MacBook Pro (Apple M3 Pro, 36 GB RAM), excluding sequencing and manual gap-filling time.

## Installation

### Ubuntu Linux

**1. Install Docker**

```bash
sudo apt install ca-certificates curl gnupg -y
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y
```

Allow the current user to run Docker without `sudo`, then restart the session:

```bash
sudo usermod -aG docker $USER
```

**2. Install Node.js (LTS)**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/HEAD/install.sh | bash
source ~/.bashrc

nvm install --lts
nvm alias default lts/*
```

**3. Install the Nextstrain CLI**

```bash
curl -fsSL --proto '=https' https://nextstrain.org/cli/installer/linux | bash
nextstrain setup --set-default docker
```

**4. Install HantaCon**

```bash
git clone https://github.com/KU-MV/HantaCon.git
cd HantaCon
npm i
docker compose build --no-cache
```

Verify that the backend container is working:

```bash
docker compose run --rm hantacon bcftools --version
```

<!-- TODO: confirm the service name used in docker-compose.yml (hantacon or hantacon_core) -->
<!-- TODO: add the command or desktop entry that launches the application -->

**Uninstalling**

```bash
sudo dpkg --remove hantacon
docker compose down --rmi all --remove-orphans
```

### macOS

Install Docker Desktop and start it before the first run. Node.js and HantaCon are installed as in steps 2 and 4 above, replacing `source ~/.bashrc` with `source ~/.zshrc`.

<!-- TODO: add the macOS Nextstrain CLI installer command and confirm whether the host CLI is required at all -->

### Building distributable packages (developers)

```bash
sudo apt install -y ruby ruby-dev build-essential rpm fakeroot dpkg-dev zlib1g-dev gzip tar xz-utils
```

## Usage

HantaCon supports two primary analysis modes:

1. **FASTQ workflow**  
   Nanopore sequencing reads → consensus genome generation → phylogeographic analysis → Nextstrain visualization

2. **FASTA workflow**  
   Prepared HTNV genome sequences → phylogeographic analysis → Nextstrain visualization

The interface is organized into five tabs: **Home**, **Sequence**, **Phylodynamics**, **Visualization**, and **Settings**.

### 1. Sequence: consensus generation

<img src="src/img/screenshots/2.png" alt="Consensus sequence tab" width="640">

Enter a sample prefix, select a FASTQ file, and choose the reference genome (HTNV_76-118). The consensus thresholds can be adjusted:

| Parameter | Default |
|---|---|
| Variant quality threshold | 10 |
| Variant depth threshold | 50 |
| Low coverage threshold | 5 |

Press **Generate** to run the workflow. Reads are aligned to the tripartite reference, segment-specific alignments are separated, variants are called and filtered, and low-coverage regions are masked. The output is one consensus FASTA file per segment, with the thresholds used for the run recorded in the FASTA header. Press **Open result** to view the output directory.

Genome coverage is calculated relative to the HTNV 76-118 reference, excluding the terminal 14 bp conserved sequences at both ends of each segment.

### 2. Phylodynamics: metadata and phylogenetic analysis

<img src="src/img/screenshots/3.png" alt="Phylodynamic analysis tab" width="640">

Select a consensus FASTA file and the corresponding genomic segment (L, M, or S). Enter the sample information used for phylogeographic placement:

- **Host**: host species of the specimen (for example, *Homo sapiens* or *Apodemus agrarius*)
- **Location**: country, province, city, and town. Enter `unknown` when a level is not available.
- **Collection date**: year, month, and day

Press **Generate metadata** to build the dataset and run the segment-specific analysis against the bundled reference database. Each segment is analyzed separately.

### 3. Visualization: interactive exploration

Open the Auspice viewer to explore the resulting phylogeny. Tips can be coloured by metadata field, filtered by query, and restricted to a date range. The Geography panel maps sequences by their annotated locality, and the entropy panel shows nucleotide diversity across the genome.

## Reference database

HantaCon includes a curated reference database of *Orthohantavirus hantanense* sequences from the Republic of Korea with associated geographic, temporal, host, and lineage metadata.

The reference dataset is designed for segment-specific phylogeographic comparison of the L, M, and S genomic segments.

| | |
|---|---|
| Source | Publicly available HTNV and Soochong virus sequences retrieved from GenBank (accessed 30 August 2025) |
| Size | 163 L-segment, 164 M-segment, and 165 S-segment sequences |
| Temporal range | 1976 to 2023 |
| Spatial resolution | Town (ri), municipality (si or gun), and province |
| Metadata fields | Strain name, lineage designation, host species, collection date, GenBank accession number, and geographic coordinates |

Sequences were included if they had complete coding sequence coverage for the segment, a collection date at least at year-level resolution, host species annotation, and geographic metadata assignable within the Republic of Korea at a resolution suitable for mapping. Sequences with imprecise geographic metadata, evident sequencing errors, or originating from the same isolate as an already included sequence were excluded. HTNV lineages were assigned according to previously established phylogenetic criteria.

## Dependencies

The following tools are pre-installed in the containerized environment.

| Tool | Version | Role |
|---|---|---|
| minimap2 | 2.30 | Read alignment |
| SAMtools | 1.23.1 | Alignment processing |
| Medaka | 2.2.0 | Consensus calling and variant identification |
| BCFtools | 1.23.1 | Variant filtering and consensus generation |
| BEDTools | 2.31.1 | Low-coverage masking |
| SeqKit | 2.13.0 | Sequence handling |
| HTSlib | 1.23.1 | File format support |
| vcfpy | 0.13.6 | VCF handling |
| MAFFT | 7.526 | Multiple sequence alignment |
| IQ-TREE | 2.4.0 | Maximum-likelihood phylogenetic inference |
| TreeTime | 0.11.1 | Tree processing and metadata annotation |
| k8 | 1.2 | Script execution |
| Python | 3.10 | Custom filtering scripts |
| Augur and Auspice | Nextstrain framework | Dataset preparation and visualization |

## Data availability

Whole-genome sequences generated in the associated study are deposited in GenBank under accession numbers PZ685873 to PZ685908, available from the date of publication. The curated reference sequences used to build the localized HTNV database are included in this repository.

## Citation

If you use HantaCon in your research, please cite:

<!-- TODO: replace with the full citation and DOI once published -->
> Park K, Kim J, Lee J, et al. Genomic surveillance of Hantaan virus for exposure-site investigation of haemorrhagic fever with renal syndrome: an integrated desktop workflow applied to military cases in the Republic of Korea. [Journal] ([Year]).

## References

HantaCon builds on the following tools. Please also cite them where appropriate.

- **Nextstrain**: Hadfield J, Megill C, Bell SM, et al. Nextstrain: real-time tracking of pathogen evolution. *Bioinformatics*. 2018;34(23):4121-4123.
- **minimap2**: Li H. Minimap2: pairwise alignment for nucleotide sequences. *Bioinformatics*. 2018;34(18):3094-3100.
- **SAMtools and BCFtools**: Danecek P, Bonfield JK, Liddle J, et al. Twelve years of SAMtools and BCFtools. *GigaScience*. 2021;10(2):giab008.
- **BEDTools**: Quinlan AR. BEDTools: the Swiss-army tool for genome feature analysis. *Curr Protoc Bioinformatics*. 2014;47:11.12.1-11.12.34.
- **SeqKit**: Shen W, Le S, Li Y, Hu F. SeqKit: a cross-platform and ultrafast toolkit for FASTA/Q file manipulation. *PLoS One*. 2016;11(10):e0163962.
- **VCFPy**: Holtgrewe M, Beule D. VCFPy: a Python 3 library with good support for both reading and writing VCF. *J Open Source Softw*. 2016;1(6):85.
- **MAFFT**: Katoh K, Misawa K, Kuma K, Miyata T. MAFFT: a novel method for rapid multiple sequence alignment based on fast Fourier transform. *Nucleic Acids Res*. 2002;30(14):3059-3066.
- **IQ-TREE**: Nguyen LT, Schmidt HA, von Haeseler A, Minh BQ. IQ-TREE: a fast and effective stochastic algorithm for estimating maximum-likelihood phylogenies. *Mol Biol Evol*. 2015;32(1):268-274.
- **TreeTime**: Sagulenko P, Puller V, Neher RA. TreeTime: maximum-likelihood phylodynamic analysis. *Virus Evol*. 2018;4(1):vex042.
- **Snakemake**: Koster J, Rahmann S. Snakemake: a scalable bioinformatics workflow engine. *Bioinformatics*. 2012;28(19):2520-2522.
- **HTNV lineage criteria**: Park K, Kim J, Kim SG, Kim WK, Song JW. Molecular evolution and reassortment dynamics of *Orthohantavirus hantanense* revealed through longitudinal genomic surveillance in the Republic of Korea. *Sci Rep*. 2025;15:24672.

## License

<!-- TODO: choose a license, add a LICENSE file, and state it here -->
License information will be added soon.

## Developed by

<img src="src/img/lab.png" alt="Song Lab" width="150" align="left" hspace="20">

**Song Lab, Hantavirus Genomics and Epidemiology**  
Department of Microbiology and Institute for Viral Diseases  
Korea University College of Medicine, Seoul, Republic of Korea

<br clear="left">

Reference viral genomic sequences used in this program were obtained from the GenBank database.

## Funding

This work was supported by the National Research Foundation of Korea (grant number 2023R1A2C2006105) and the Agency for Defense Development (grant numbers UE242006TD and 411FF5-912A01201).

## Contact

Questions and bug reports are best submitted through [Issues](https://github.com/KU-MV/HantaCon/issues).

- Program operation and maintenance: Kyungmin Park, PhD (kmpark0131@korea.ac.kr)
- Scientific inquiries and use of original genomic sequences or project-derived results in publications: Jin-Won Song, MD, PhD (jwsong@korea.ac.kr)
