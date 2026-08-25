const Sequence = {
  workflow: "Sequence",
  steps: [
    {
      id: "map_reads",
      title: "Map Reads",
      enabled: true,
      docker:{
        service:"hantacon_core",
        shell:"micromamba run -n HantaCon"
      },
      cwd: "{{map_reads_dir}}",
      cmd: [
        "mini_align -t 4 -I 4G -p {{prefix}} -i {{fastq}} -r {{all_segments}} -m -f -M 2 -S 4 -O 4,24 -E 2,1",
        "samtools sort {{prefix}}.bam -o {{bams_dir}}/{{prefix}}.sort.bam",
        "samtools index {{bams_dir}}/{{prefix}}.sort.bam",
        "samtools view -o {{bams_dir}}/{{prefix}}_L.bam -b {{bams_dir}}/{{prefix}}.sort.bam {{L_acc}}",
        "samtools view -o {{bams_dir}}/{{prefix}}_M.bam -b {{bams_dir}}/{{prefix}}.sort.bam {{M_acc}}",
        "samtools view -o {{bams_dir}}/{{prefix}}_S.bam -b {{bams_dir}}/{{prefix}}.sort.bam {{S_acc}}"
      ],
      output: {
        sorted_bam: "{{bams_dir}}/{{prefix}}.sort.bam",
        sorted_bam_index: "{{bams_dir}}/{{prefix}}.sort.bam.bai",
        bam_L: "{{bams_dir}}/{{prefix}}_L.bam",
        bam_M: "{{bams_dir}}/{{prefix}}_M.bam",
        bam_S: "{{bams_dir}}/{{prefix}}_S.bam"
      }
    },
    {
      id: "consensus_L",
      title: "Consensus Calling L",
      enabled: true,
      docker:{
        service:"hantacon_core",
        shell:"micromamba run -n HantaCon"
      },
      cwd: "{{consensus_L_dir}}",
      cmd: [
        "samtools index {{bam_L}}",
        "medaka inference --model r941_prom_sup_variant_g507 --threads 8 --batch_size 100 {{bam_L}} {{prefix}}_L.hdf",
        "medaka vcf {{prefix}}_L.hdf {{reference_L}} {{prefix}}_L.medaka.vcf",
        "medaka tools annotate --dpsp {{prefix}}_L.medaka.vcf {{reference_L}} {{bam_L}} {{prefix}}_L.medaka.annotated.vcf",

        "bcftools view -i 'QUAL>{{variant_quality_threshold}} & INFO/DP>{{variant_depth_threshold}}' {{prefix}}_L.medaka.annotated.vcf > {{prefix}}_L.medaka.filtered.vcf",
        "python /opt/hantacon/scripts/filter_indel_with_sr.py --input {{prefix}}_L.medaka.filtered.vcf --output {{prefix}}_L.medaka.indel_filtered.vcf",
        "bgzip -f {{prefix}}_L.medaka.indel_filtered.vcf",
        "tabix -p vcf {{prefix}}_L.medaka.indel_filtered.vcf.gz",

        "bcftools consensus -f {{reference_L}} {{prefix}}_L.medaka.indel_filtered.vcf.gz > {{prefix}}_L.consensus.nodropped.fasta",

        "bedtools genomecov -bga -ibam {{bam_L}} > {{prefix}}_L.genomecov.bed",

        "awk -v threshold={{low_cov_threshold}} '\\$4 < threshold' {{prefix}}_L.genomecov.bed > {{prefix}}_L.low_cov.bed",
        
        "bedtools merge -i {{prefix}}_L.low_cov.bed > low_cov_{{low_cov_threshold}}_L.bed",
        
        "bedtools maskfasta -fi {{prefix}}_L.consensus.nodropped.fasta -bed low_cov_{{low_cov_threshold}}_L.bed -fo {{resultDir}}/{{prefix}}_L.fasta",

        "sed -i \"1s/.*/>{{prefix}}_L low_cov_thrs={{low_cov_threshold}} var_qual_thrs={{variant_quality_threshold}} var_depth_thrs={{variant_depth_threshold}}/\" {{resultDir}}/{{prefix}}_L.fasta"
      ],
      output: {
        consensus_L: "{{resultDir}}/{{prefix}}_L.fasta"
      }
    },
    {
      id: "consensus_M",
      title: "Consensus Calling M",
      enabled: true,
      docker:{
        service:"hantacon_core",
        shell:"micromamba run -n HantaCon"
      },
      cwd: "{{consensus_M_dir}}",
      cmd: [
        "samtools index {{bam_M}}",
        "medaka inference --model r941_prom_sup_variant_g507 --threads 8 --batch_size 100 {{bam_M}} {{prefix}}_M.hdf",
        "medaka vcf {{prefix}}_M.hdf {{reference_M}} {{prefix}}_M.medaka.vcf",
        "medaka tools annotate --dpsp {{prefix}}_M.medaka.vcf {{reference_M}} {{bam_M}} {{prefix}}_M.medaka.annotated.vcf",
        "bcftools view -i 'QUAL>{{variant_quality_threshold}} & INFO/DP>{{variant_depth_threshold}}' {{prefix}}_M.medaka.annotated.vcf > {{prefix}}_M.medaka.filtered.vcf",
        "python /opt/hantacon/scripts/filter_indel_with_sr.py --input {{prefix}}_M.medaka.filtered.vcf --output {{prefix}}_M.medaka.indel_filtered.vcf",
        "bgzip -f {{prefix}}_M.medaka.indel_filtered.vcf",
        "tabix -p vcf {{prefix}}_M.medaka.indel_filtered.vcf.gz",

        "bcftools consensus -f {{reference_M}} {{prefix}}_M.medaka.indel_filtered.vcf.gz > {{prefix}}_M.consensus.nodropped.fasta",

        "bedtools genomecov -bga -ibam {{bam_M}} > {{prefix}}_M.genomecov.bed",

        "awk -v threshold={{low_cov_threshold}} '\\$4 < threshold' {{prefix}}_M.genomecov.bed > {{prefix}}_M.low_cov.bed",

        "bedtools merge -i {{prefix}}_M.low_cov.bed > low_cov_{{low_cov_threshold}}_M.bed",

        "bedtools maskfasta -fi {{prefix}}_M.consensus.nodropped.fasta -bed low_cov_{{low_cov_threshold}}_M.bed -fo {{resultDir}}/{{prefix}}_M.fasta",

        "sed -i \"1s/.*/>{{prefix}}_M low_cov_thrs={{low_cov_threshold}} var_qual_thrs={{variant_quality_threshold}} var_depth_thrs={{variant_depth_threshold}}/\" {{resultDir}}/{{prefix}}_M.fasta"
      ],
      output: {
        consensus_M: "{{resultDir}}/{{prefix}}_M.fasta"
      }
    },
    {
      id: "consensus_S",
      title: "Consensus Calling S",
      enabled: true,
      docker:{
        service:"hantacon_core",
        shell:"micromamba run -n HantaCon"
      },
      cwd: "{{consensus_S_dir}}",
      cmd: [
        "samtools index {{bam_S}}",
        
        "medaka inference --model r941_prom_sup_variant_g507 --threads 8 --batch_size 100 {{bam_S}} {{prefix}}_S.hdf",
        "medaka vcf {{prefix}}_S.hdf {{reference_S}} {{prefix}}_S.medaka.vcf",
        "medaka tools annotate --dpsp {{prefix}}_S.medaka.vcf {{reference_S}} {{bam_S}} {{prefix}}_S.medaka.annotated.vcf",

        
        "bcftools view -i 'QUAL>{{variant_quality_threshold}} & INFO/DP>{{variant_depth_threshold}}' {{prefix}}_S.medaka.annotated.vcf > {{prefix}}_S.medaka.filtered.vcf",
        "python /opt/hantacon/scripts/filter_indel_with_sr.py --input {{prefix}}_S.medaka.filtered.vcf --output {{prefix}}_S.medaka.indel_filtered.vcf",
        "bgzip -f {{prefix}}_S.medaka.indel_filtered.vcf",
        "tabix -p vcf {{prefix}}_S.medaka.indel_filtered.vcf.gz",

        "bcftools consensus -f {{reference_S}} {{prefix}}_S.medaka.indel_filtered.vcf.gz > {{prefix}}_S.consensus.nodropped.fasta",

        "bedtools genomecov -bga -ibam {{bam_S}} > {{prefix}}_S.genomecov.bed",

        "awk -v threshold={{low_cov_threshold}} '\\$4 < threshold' {{prefix}}_S.genomecov.bed > {{prefix}}_S.low_cov.bed",

        "bedtools merge -i {{prefix}}_S.low_cov.bed > low_cov_{{low_cov_threshold}}_S.bed",

        "bedtools maskfasta -fi {{prefix}}_S.consensus.nodropped.fasta -bed low_cov_{{low_cov_threshold}}_S.bed -fo {{resultDir}}/{{prefix}}_S.fasta",

        "sed -i \"1s/.*/>{{prefix}}_S low_cov_thrs={{low_cov_threshold}} var_qual_thrs={{variant_quality_threshold}} var_depth_thrs={{variant_depth_threshold}}/\" {{resultDir}}/{{prefix}}_S.fasta"
      ],
      output: {
        consensus_S: "{{resultDir}}/{{prefix}}_S.fasta"
      }
    }
  ]
};

const Phylodynamic = {
  workflow: "Phylodynamic analysis",
  steps: [
     {
        id: "mafft_align",
        title: "MAFFT Alignment",
        enabled: true,
        docker: {
          service: "hantacon_core",
          shell: "micromamba run -n HantaCon"
        },
        cwd: "{{htvDir}}",
        cmd: [
          "mafft {{htv_sequence}} > {{htvDir}}/htv_aligned.fasta",
          "cp {{htvDir}}/htv_aligned.fasta {{htv_sequence}}"
        ],
        output: {
          aligned_fasta: "{{htvDir}}/htv_aligned.fasta"
        }
    },
    {
      id: "nextstrain_build",
      title: "Nextstrain Build",
      enabled: true,
      docker: {
        service: "hantacon_nextstrain",
        shell: ""
      },
      cwd: "{{htvDir}}",
      cmd: [
        "snakemake -c 4",
        "cp {{htvDir}}/auspice/htv_{{fastaType}}.json {{resultDir}}/htv_{{fastaType}}.json",
        "cp {{htvDir}}/auspice/htv_{{fastaType}}.json {{auspiceDir}}/{{runId}}_htv_{{fastaType}}.json"
      ],
      output: {
        auspice_json: "{{resultDir}}/htv_{{fastaType}}.json"
      }
    }
  ]
};



module.exports = { Sequence, Phylodynamic };