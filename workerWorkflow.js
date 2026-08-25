const { parentPort, workerData } = require('worker_threads');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Sequence, Phylodynamic } = require('./workflow.js');

const params = workerData;
const workspaceDir = workerData.workspaceDir;
const HantaConBase = workerData.HantaConBase;
const composeFile = workerData.composeFile

// =============================
// 캐시용 전역 컨텍스트
// =============================
const workflowCache = {}; // 모든 스텝의 output을 key:path 형태로 저장

// =============================
// docker 설정 (infra only)
// =============================
const dockerEnv = {
  enabled: true,
  docker: "docker",
  composeFile: composeFile
};

// =============================
// workspace 준비
// =============================
function SequenceWorkspace(params) {
  const now = new Date();
  const runId =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + 
    "_" +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');

  const tmpDir = path.join(workspaceDir, "work", "sequence", runId);
  const resultDir = path.join(workspaceDir, "result", runId);

  const map_reads_dir = path.join(tmpDir, "map_reads");
  const bams_dir = path.join(tmpDir, "bams");
  const consensus_L_dir = path.join(tmpDir, "consensus_L");
  const consensus_M_dir = path.join(tmpDir, "consensus_M");
  const consensus_S_dir = path.join(tmpDir, "consensus_S");
  
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(resultDir, { recursive: true });
  fs.mkdirSync(map_reads_dir, { recursive: true });
  fs.mkdirSync(bams_dir, { recursive: true });
  fs.mkdirSync(consensus_L_dir, { recursive: true });
  fs.mkdirSync(consensus_M_dir, { recursive: true });
  fs.mkdirSync(consensus_S_dir, { recursive: true });
    
  parentPort.postMessage({type:"msg", data:`[Workspace] ${tmpDir}`});

  function mergeFasta(refL, refM, refS, tmpDir) {

    const output = path.join(tmpDir, "all_segments.fasta");

    const L = fs.readFileSync(refL, "utf8");
    const M = fs.readFileSync(refM, "utf8");
    const S = fs.readFileSync(refS, "utf8");

    const merged =
      L.trimEnd() + "\n" +
      M.trimEnd() + "\n" +
      S.trimEnd() + "\n";

    fs.writeFileSync(output, merged);

    return output;
  }

  function extractSeqName(fastaPath) {
    const content = fs.readFileSync(fastaPath, "utf8");

    return content
      .split("\n")
      .filter(line => line.startsWith(">"))
      .map(line =>
        line
          .substring(1)      // > 제거
          .split(" ")[0]     // cut -d ' ' -f1
          .trim()
      );
  }

  function dockerPath(p) {
    return p.replace(workspaceDir, "/workspace");
  }

  // ------------------- 하드코딩된 reference -------------------
  const ref = {
    "HTNV_76-118": {
      L: path.join(__dirname, "resources", "reference", "HTNV_76-118", "HTNV_76-118_L.fasta"),
      M: path.join(__dirname, "resources", "reference", "HTNV_76-118", "HTNV_76-118_M.fasta"),
      S: path.join(__dirname, "resources", "reference", "HTNV_76-118", "HTNV_76-118_S.fasta")
    },
    "HTNV_Ac20-5": {
      L: path.join(__dirname, "resources", "reference", "HTNV_Ac20-5", "HTNV_Ac20-5_L.fasta"),
      M: path.join(__dirname, "resources", "reference", "HTNV_Ac20-5", "HTNV_Ac20-5_M.fasta"),
      S: path.join(__dirname, "resources", "reference", "HTNV_Ac20-5", "HTNV_Ac20-5_S.fasta")
    }
  };

  // ------------------- 선택적 복사 함수 -------------------
  function copyFromResources(src, copyDir, name) {
    const filename = name || path.basename(src);
    const dst = path.join(copyDir, filename);

    if (!fs.existsSync(dst)) {
      fs.copyFileSync(src, dst);
      parentPort.postMessage({type:"msg", data:`Copied ${filename} to workspace`});
    }

    return dst;
  }

  function copy(src, name) {
    const filename = name || path.basename(src);
    const dst = path.join(tmpDir, filename);
    fs.copyFileSync(src, dst); return dst;
  }
  
  const refLPath = copyFromResources(ref[params.reference].L, tmpDir);
  const refMPath = copyFromResources(ref[params.reference].M, tmpDir);
  const refSPath = copyFromResources(ref[params.reference].S, tmpDir);

  const L_acc = extractSeqName(refLPath);
  const M_acc = extractSeqName(refMPath);
  const S_acc = extractSeqName(refSPath);
  const all_segments = mergeFasta(refLPath, refMPath, refSPath, tmpDir)

  return {
    runId: runId,
    // input fastq
    fastq: dockerPath(copy(params.fastq)),
    
    // reference
    reference_L: dockerPath(refLPath),
    reference_M: dockerPath(refMPath),
    reference_S: dockerPath(refSPath),

    // reference 내부 이름
    L_acc: L_acc,
    M_acc: M_acc,
    S_acc: S_acc,

    // reference 세개 합친 파일
    all_segments: dockerPath(all_segments),

    // 결과 폴더
    resultDir: dockerPath(resultDir),
    localResultDir: resultDir,
    

    // 작업용 임시 폴더
    tmpDir: dockerPath(tmpDir),
    map_reads_dir: dockerPath(map_reads_dir),
    bams_dir: dockerPath(bams_dir),
    consensus_L_dir: dockerPath(consensus_L_dir),
    consensus_M_dir: dockerPath(consensus_M_dir),
    consensus_S_dir: dockerPath(consensus_S_dir)
  };
}

function PhylodynamicsWorkspace(params) {
  function dockerPath(p) {
    return p.replace(workspaceDir, "/workspace");
  }

  // -----------------------------
  // run id 생성
  // -----------------------------
  const now = new Date();

  const runId =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + 
    "_" +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');

  // workspace
  // Sequence / KU-ONT-Consensus
  // Phylodynamics / Phylodynamic analysis
  // Visualization


  // -----------------------------
  // analysis 경로
  // -----------------------------
  const tmpDir = path.join(workspaceDir, "work", "phylodynamics", runId);
  const resultDir = path.join(workspaceDir, "result", runId);
  const auspiceDir = path.join(workspaceDir, "auspice");

  // ------------------- 하드코딩된 template -------------------
  const template = {
    L: path.join(__dirname, "resources", "template", "htv_L"),
    M: path.join(__dirname, "resources", "template", "htv_M"),
    S: path.join(__dirname, "resources", "template", "htv_S"),
  };

  // ------------------- 폴더 전체 복사 함수 (원본 폴더명 유지) -------------------
  function copyFolderWithName(srcDir, destParentDir) {
    if (!fs.existsSync(srcDir)) {
      throw new Error(`Source folder does not exist: ${srcDir}`);
    }

    // 원본 폴더명
    const folderName = path.basename(srcDir);
    const destDir = path.join(destParentDir, folderName);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        copyFolderWithName(srcPath, destDir); // 하위 폴더 재귀 복사
      } else if (entry.isFile()) {
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }

    return destDir; // 최종 복사된 폴더 경로 리턴
  }


  const selectTemplate = template[params.fastaType]; // L, M, S 중 선택

  // -----------------------------
  // 기본 폴더 생성
  // -----------------------------
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(resultDir, { recursive: true });
  fs.mkdirSync(auspiceDir, { recursive: true });

  const htvDir = copyFolderWithName(selectTemplate, tmpDir);
  const htv_sequence = path.join(htvDir, "data", "sequence.fasta");
  const htv_metadata = path.join(htvDir, "data", "metadata.tsv");

  // =====================================
  // FASTA → 첫 strain만 추출
  // =====================================
  function readFirstFastaEntry(fastaPath) {

    const content = fs.readFileSync(fastaPath, "utf8");
    const lines = content.split(/\r?\n/);

    let strain = null;
    let buffer = [];

    for (const line of lines) {

      if (line.startsWith(">")) {

        // 이미 하나 읽었으면 종료
        if (strain !== null) break;

        strain = line
          .substring(1)
          .split(" ")[0]
          .trim();

        continue;
      }

      if (strain && line.trim()) {
        buffer.push(line.trim());
      }
    }

    return {
      strain,
      data: buffer.join("")
    };
  }


  // =====================================
  // metadata → TSV line 생성
  // =====================================
  function metadataToTSV(metadata, strain) {

    const fields = [
      "strain",
      "host",
      "genetic_exchange",
      "lineage",
      "hybrid_zone",
      "accession",
      "date",
      "province",
      "country",
      "city",
      "town",
      "db",
      "title",
      "journal",
      "paper_url"
    ];

    return fields.map(field => {
      
      let value;

      if (field === "strain") {
        value = strain;
      } else {
        value =
          metadata[field] != null && metadata[field] !== ""
            ? metadata[field]
            : "";
      }

      // 항상 "" 로 감싸기
      return `${value}`;

    }).join("\t");
  }


  // =====================================
  // FASTA append
  // =====================================
  function appendFasta(sequencePath, entry) {

    const text = ">" + entry.strain + "\n" + entry.data;
    fs.appendFileSync(sequencePath, "\n" + text, "utf8");
  }


  // =====================================
  // Metadata append
  // =====================================
  function appendMetadata(metadataPath, line) {
    fs.appendFileSync(metadataPath, "\n" + line, "utf8");
  }


  // =====================================
  // 전체 실행 (핵심)
  // =====================================
  function addStrainToTemplate(params) {

    const entry = readFirstFastaEntry(params.fasta);

    const metadataLine = metadataToTSV(params, entry.strain);

    appendFasta(htv_sequence, entry);
    appendMetadata(htv_metadata, metadataLine);
  }


  // 실행
  addStrainToTemplate(params);

  // -----------------------------
  // return
  // -----------------------------
  return {
    runId: runId,
    tmpDir: dockerPath(tmpDir),
    resultDir: dockerPath(resultDir),
    htvDir: dockerPath(htvDir),
    htv_sequence: dockerPath(htv_sequence),
    htv_metadata: dockerPath(htv_metadata),
    localResultDir: resultDir,
    auspiceDir: dockerPath(auspiceDir)
  };
}



// =============================
// 변수 치환
// =============================
function replaceVars(cmd) {
  let r = cmd;

  for (const k in workflowCache) {
    r = r.replace(
      new RegExp(`{{${k}}}`, "g"),
      workflowCache[k]
    );
  }

  return r;
}


// =============================
// docker exec - 서비스, shell 기반 분기
// =============================
function dockerExec(cmd, step) {
  // step.cwd가 있으면 변수 치환, 없으면 임시 디렉토리
  const cdPath = step.cwd ? replaceVars(step.cwd) : workflowCache.tmp_dir;

  // step.docker 객체가 있으면 서비스와 shell 사용
  const service =
    step.docker && step.docker.service
      ? step.docker.service
      : dockerEnv.service; // 기본 서비스

  const shell =
    step.docker && step.docker.shell
      ? step.docker.shell + " "
      : ""; // shell이 없으면 빈 문자열

  return `
${dockerEnv.docker} compose \
-f ${dockerEnv.composeFile} \
exec -T \
${service} \
bash -lc "cd ${cdPath} && ${shell}${cmd.replace(/"/g, '\\"')}"
`;
}


// =============================
// docker start
// workflow에서 service 자동 수집
// =============================
async function startDocker(workflow) {

  parentPort.postMessage({
    type: "msg",
    data: "[Docker] starting..."
  });

  // step 에서 service 자동 수집
  const services = new Set();

  workflow.steps.forEach(step => {
    if (!step.enabled || !step.docker) return;

    if (typeof step.docker === "object") {
      services.add(step.docker.service);
    } else {
      services.add("hantacon_core");
    }
  });

  const serviceList = Array.from(services).join(" ");

  // 실제 실행할 Docker 커맨드 문자열
  const dockerCmd = dockerEnv.docker + " compose" +
                    " -f " + dockerEnv.composeFile +
                    " up -d --remove-orphans " + serviceList;

  // 🔹 커맨드 자체 로그
  parentPort.postMessage({
    type: "msg",
    data: "[Docker] Executing command: " + dockerCmd
  });

  try {
    // 🔹 기존 runShellCommand 호출
    await runShellCommand(dockerCmd);

    parentPort.postMessage({
      type: "msg",
      data: "[Docker] Ready"
    });

  } catch (err) {
    parentPort.postMessage({
      type: "error",
      data: "[Docker Error] " + (err.message || "Unknown error") +
            "\nExit code: " + (err.code || "N/A") +
            "\nSTDOUT: " + (err.stdout || "N/A") +
            "\nSTDERR: " + (err.stderr || "N/A")
    });

    throw err;
  }
}

// =============================
// output 체크
// =============================
function validateOutputs(outputs) {

  if (!outputs) return true;

  for (let key in outputs) {

    const resolved =
      replaceVars(outputs[key]);

    const host =
      resolved.replace(
        "/workspace",
        workspaceDir
      );

    workflowCache[key] = resolved;

    if (!fs.existsSync(host)) {

      parentPort.postMessage({
        type:"error",
        data:`[Missing] ${host}`
      });

      return false;
    }

    parentPort.postMessage({
      type:"msg",
      data:`[OK] ${host}`
    });
  }

  return true;
}


// =============================
// shell 실행
// =============================
function runShellCommand(cmd, onData) {

  return new Promise((resolve, reject) => {

    const proc = spawn(
      cmd,
      {
        shell: true,
        env: process.env
      }
    );

    proc.stdout.on(
      "data",
      d => onData?.(d)
    );

    proc.stderr.on(
      "data",
      d => onData?.(d)
    );

    proc.on(
      "close",
      code =>
        code === 0
          ? resolve()
          : reject(
              new Error(`exit ${code}`)
            )
    );
  });
}

// =============================
// Docker Compose 명령어 실행
// =============================
async function handleDockerWorkflow(type) {
    parentPort.postMessage({
        type: "msg",
        data: `[Docker] ${type} started...`
    });

    try {
        let cmd = "";
        if (type === "restart") {
            // 모든 서비스 재시작
            cmd = `${dockerEnv.docker} compose -f ${dockerEnv.composeFile} up -d --remove-orphans`;
        } else if (type === "reinstall") {
            // 이미지 Pull 후 강제 재생성
            cmd = `${dockerEnv.docker} compose -f ${dockerEnv.composeFile} pull && ${dockerEnv.docker} compose -f ${dockerEnv.composeFile} up -d --force-recreate`;
        } else {
            throw new Error("Unknown Docker workflow type: " + type);
        }

        parentPort.postMessage({
            type: "msg",
            data: cmd
        });

        await runShellCommand(cmd, d =>
            parentPort.postMessage({ type: "msg", data: d.toString() })
        );

        parentPort.postMessage({
            type: "msg",
            data: `[Docker] ${type} finished`
        });

    } catch (err) {
        parentPort.postMessage({
            type: "error",
            data: `[Docker ${type} error] ${err.message}`
        });
    }

    parentPort.close();
}


// =============================
// workflow 실행
// =============================
async function runWorkflow() {
  // 🔹 restart / reinstall 분기 처리
  if (params.workflow === "restart" || params.workflow === "reinstall") {
      await handleDockerWorkflow(params.workflow);
      return;
  }


  const workflows = {
      "Sequence": Sequence,
      "Phylodynamic": Phylodynamic
  };

  const workflow = workflows[params.workflow]

  if (params.workflow === "Sequence") {
    Object.assign(
      workflowCache,
      {
        ...params,
        ...SequenceWorkspace(params)
      }
    );
  } else if (params.workflow === "Phylodynamic") {
    Object.assign(
      workflowCache,
      {
        ...params,
        ...PhylodynamicsWorkspace(params)
      }
    );
  }
  
  try {
    await startDocker(workflow);
  }
  catch (err) {

    parentPort.postMessage({
      type:"error",
      data:`[Setup Error] ${err.message}`
    });

    return;
  }

  const enabledSteps =
    workflow.steps.filter(
      s => s.enabled
    );

  const totalSteps =
    enabledSteps.length;

  let currentStep = 0;
  let workflowFailed = false;

  for (const step of enabledSteps) {

    parentPort.postMessage({
      type:"progress",
      data:{
        current: currentStep,
        total: totalSteps,
        title: step.title,
        stepId: step.id
      }
    });

    parentPort.postMessage({
      type:"msg",
      data:`[Step] ${step.title}`
    });

    currentStep++;

    try {

      for (const rawCmd of step.cmd) {

        const cmd =
          replaceVars(rawCmd);

        const finalCmd =
          step.docker
            ? dockerExec(cmd, step)
            : cmd;

        parentPort.postMessage({
          type:"msg",
          data: rawCmd
        });

        await runShellCommand(
          finalCmd,
          d =>
            parentPort.postMessage({
              type:"msg",
              data:d.toString()
            })
        );
      }

      if (!validateOutputs(step.output)) {
        throw new Error(
          "Output validation failed"
        );
      }

    }
    catch (err) {

      workflowFailed = true;

      parentPort.postMessage({
        type:"error",
        data:`[Error ${step.id}] ${err.message}`
      });

      parentPort.postMessage({
        type:"progress",
        data:{
          current: currentStep,
          total: totalSteps,
          title: step.title + " error",
          stepId: step.id
        }
      });

      break;
    }
  }

  if (!workflowFailed) {

    parentPort.postMessage({
      type:"progress",
      data:{
        current: totalSteps,
        total: totalSteps,
        title:"COMPLETE",
        stepId:"END"
      }
    });

    parentPort.postMessage({
      type:"msg",
      data:"[ END ]"
    });

  } else {

    try {
      if (fs.existsSync(workflowCache.localResultDir)) {
        fs.rmSync(workflowCache.localResultDir, { recursive: true, force: true });
      }
    } catch(e){}
  }

  parentPort.close();
}


// =============================
runWorkflow();